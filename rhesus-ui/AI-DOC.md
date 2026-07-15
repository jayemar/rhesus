Use playwrite to verify the functionality of UI changes. There is a TT-RSS account set up for this with credentials given in .env.playwrite

Changes need to be deployed to take effect. Pushing to main triggers
.github/workflows/rhesus-server-image.yml, which builds and pushes
ghcr.io/jayemar/rhesus-server:latest - the homelab repo then just needs
`docker compose pull rhesus-server && docker compose up -d rhesus-server`.

To test locally before pushing, build and run the image yourself:
- npm run build
- docker build -t ghcr.io/jayemar/rhesus-server:latest -f rhesus-server/Dockerfile .
- docker compose up -d rhesus-server (in the homelab repo)

