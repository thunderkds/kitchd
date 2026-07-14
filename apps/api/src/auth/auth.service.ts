import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role, Theme } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

export interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    organizationId: string;
    kitchenId: string;
    role: Role;
    themePreference: Theme;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: { name: dto.organizationName },
        });
        const kitchen = await tx.kitchen.create({
          data: { name: dto.kitchenName, organizationId: organization.id },
        });
        return tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            organizationId: organization.id,
            kitchenId: kitchen.id,
          },
        });
      });

      return this.buildAuthResult(
        user.id,
        user.email,
        user.organizationId,
        user.kitchenId,
        user.role,
        user.themePreference,
      );
    } catch (err) {
      // Unique constraint violation on email (e.g. concurrent duplicate signup) —
      // the transaction has already rolled back all rows, so nothing partial is left behind.
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // A deactivated (removed) user gets the same generic 401 as a wrong
    // password — never leak account state via a distinct error message.
    if (!user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResult(
      user.id,
      user.email,
      user.organizationId,
      user.kitchenId,
      user.role,
      user.themePreference,
    );
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    );
  }

  private buildAuthResult(
    id: string,
    email: string,
    organizationId: string,
    kitchenId: string,
    role: Role,
    themePreference: Theme,
  ): AuthResult {
    // Intentionally no `role` claim in the JWT payload: RolesGuard always
    // re-reads the current role from the database rather than trusting a
    // claim baked into a (possibly stale) token.
    const accessToken = this.jwtService.sign({
      sub: id,
      email,
      organizationId,
      kitchenId,
    });

    return {
      accessToken,
      user: { id, email, organizationId, kitchenId, role, themePreference },
    };
  }
}
