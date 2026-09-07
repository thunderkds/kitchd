const PREFIX = '$mockbcrypt$';

export async function hash(password: string, saltRounds: number): Promise<string> {
  return `${PREFIX}${saltRounds}$${password}`;
}

export async function compare(password: string, hashed: string): Promise<boolean> {
  return hashed.startsWith(PREFIX) && hashed.endsWith(`$${password}`);
}

export default {
  hash,
  compare,
};
