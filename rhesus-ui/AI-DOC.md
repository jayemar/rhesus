Use playwrite to verify the functionality of UI changes. There is a TT-RSS account set up for this with credentials given in .env.playwrite

Changes need to be deployed to take effect. Deploymemt of changes may require some combination of the following
- npm run build
- docker compose build frontend
- docker compose up -d frontend

