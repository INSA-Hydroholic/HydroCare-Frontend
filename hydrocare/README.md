1. Start the backend
The backend runs with a docker. Clone the backend repository (https://github.com/INSA-Hydroholic/Hydroholic-back) and start the containers.

# Start the Postgres DB and the Express server
docker compose up -d --build

# Wait ~5s for the DB to be ready and initialize the schema
docker compose exec server npx prisma db push

# Inject and execute seed.ts to create mock data
docker compose cp prisma/seed.ts server:/app/prisma/seed.ts
docker compose exec server npx prisma db seed

# npx prisma studio
If you want to visualize the database with Prisma Studio, you can execute the command:
docker compose exec server npx prisma studio --port 5555 --browser none


2. Start the frontend

npm install
npm run dev
Open http://localhost:5173 in the browser.

3. Connect to the site
Use the Staff Account created by our seed :
Username: jean_nurse
Password : Hydroholic123!

RESIDENTS cannot connect to the dashboard, it's reserved to people with the STAFF role.

4. Reinitialize the data
If you wish to start over :
bashdocker compose cp prisma/seed.ts server:/app/prisma/seed.ts
docker compose exec server npx prisma db seed

The IDs will always be reinitialized to 1, 2, 3, 4 (the POSTGRE sequences are rolled back to 0 in the seed script).