import 'dotenv/config'; // ⭐ สำคัญ
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USER,
  password: String(process.env.DATABASE_PASSWORD), // ⭐ บังคับเป็น string
  database: process.env.DATABASE_NAME,
  entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
});

async function clearDatabase() {
  await dataSource.initialize();

  for (const meta of dataSource.entityMetadatas) {
    await dataSource.query(
      `TRUNCATE TABLE "${meta.tableName}" RESTART IDENTITY CASCADE`
    );
  }

  await dataSource.destroy();
  console.log('✅ Clear database success');
}

clearDatabase().catch(console.error);
