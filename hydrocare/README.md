1. Lancer le backend
Le backend tourne dans Docker. Clone le repo backend et démarre les containers 

# Démarre la base de données PostgreSQL + le serveur Express
docker compose up -d

# Attends enrivon 5 secondes que la DB soit prête, puis initialise le schéma
docker compose exec server npx prisma db push

# Injecte les données de test
docker compose cp prisma/seed.ts server:/app/prisma/seed.ts
docker compose exec server npx prisma db seed

2. Lancer le frontend

npm install
npm run dev
Ouvre http://localhost:5173 dans ton navigateur.

3. Se connecter
Utilise le compte infirmier créé par le seed :
ValeurIdentifiant : jean_nurse Mot de passe : Hydroholic123!

Les comptes RESIDENT ne peuvent pas se connecter au dashboard, il est réservé au rôle STAFF.


4. Réinitialiser les données
Si tu veux repartir de zéro :
bashdocker compose cp prisma/seed.ts server:/app/prisma/seed.ts
docker compose exec server npx prisma db seed
Les IDs seront toujours réinitialisés à 1, 2, 3, 4 (les séquences PostgreSQL sont remises à zéro dans le seed).