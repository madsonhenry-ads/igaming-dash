import fs from 'fs';
import path from 'path';
import { query } from './connection';
import { createLogger } from '../utils/logger';

const log = createLogger();

/**
 * Executa o schema.sql para criar todas as tabelas no banco.
 */
export async function runMigrations() {
  try {
    log.info('Executando migrações do banco de dados...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Divide em statements e executa um por um
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      await query(statement);
    }

    log.info('Migrações executadas com sucesso');
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Erro ao executar migrações');
    throw error;
  }
}