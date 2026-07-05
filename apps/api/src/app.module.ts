import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { KitchensModule } from './kitchens/kitchens.module';
import { InventoryModule } from './inventory/inventory.module';
import { RecipesModule } from './recipes/recipes.module';
import { TasksModule } from './tasks/tasks.module';
import { GuidelinesModule } from './guidelines/guidelines.module';
import { NotesModule } from './notes/notes.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ShiftLogsModule } from './shift-logs/shift-logs.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    KitchensModule,
    InventoryModule,
    RecipesModule,
    TasksModule,
    GuidelinesModule,
    NotesModule,
    AnnouncementsModule,
    ShiftLogsModule,
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
