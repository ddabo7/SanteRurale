#!/bin/bash
# Script pour vérifier les patients dans PostgreSQL

echo "=== Patients dans PostgreSQL ==="
docker exec sante_api python -c "
import asyncio
from app.database import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        result = await conn.execute(text('''
            SELECT id, nom, prenom, sexe, telephone, village, created_at
            FROM patients
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT 10
        '''))

        print(f'\n📊 Total patients: ')
        count_result = await conn.execute(text('SELECT COUNT(*) FROM patients WHERE deleted_at IS NULL'))
        print(f'   {count_result.scalar()} patients\n')

        print('Derniers patients créés:')
        print('-' * 100)
        for row in result:
            print(f'ID: {row[0]}')
            print(f'Nom: {row[1]} {row[2] or \"\"}')
            print(f'Sexe: {row[3]} | Tél: {row[4] or \"N/A\"} | Village: {row[5] or \"N/A\"}')
            print(f'Créé le: {row[6]}')
            print('-' * 100)

asyncio.run(check())
"
