#!/usr/bin/env python3
import asyncio
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.base_models import User

async def main():
    engine = create_async_engine(
        'postgresql+asyncpg://sante_dev:sante2024@localhost:5433/sante_rurale_dev',
        echo=False
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # Chercher l'utilisateur
        result = await db.execute(
            select(User).where(User.email == 'djinb77@gmail.com')
        )
        user = result.scalar_one_or_none()
        
        if not user:
            print('❌ Utilisateur djinb77@gmail.com non trouvé')
            return
        
        print(f'📋 Utilisateur trouvé:')
        print(f'   Email: {user.email}')
        print(f'   Nom: {user.prenom or ""} {user.nom}')
        print(f'   ID: {user.id}')
        
        # Supprimer
        await db.delete(user)
        await db.commit()
        print(f'✅ Utilisateur supprimé avec succès!')
    
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
