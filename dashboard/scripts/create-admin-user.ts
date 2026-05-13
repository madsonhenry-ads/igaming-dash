import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'madsonhenry.ads@gmail.com';
  const name = 'Madson Henry';
  // Criando uma senha padrão forte, mas como você usa OTP (e-mail), 
  // ela servirá apenas como fallback de segurança.
  const password = await bcrypt.hash('Admin@Dash2024!', 10);

  console.log(`🚀 Criando usuário administrador: ${email}...`);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: 'ADMIN',
        status: 'ACTIVE',
        name: name,
      },
      create: {
        email,
        name,
        password,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    console.log('✅ Usuário administrador criado/atualizado com sucesso!');
    console.log('---');
    console.log(`ID: ${user.id}`);
    console.log(`Nome: ${user.name}`);
    console.log(`E-mail: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Status: ${user.status}`);
    console.log('---');
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
