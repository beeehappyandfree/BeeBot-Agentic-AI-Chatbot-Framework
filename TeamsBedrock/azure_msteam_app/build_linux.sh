#!/bin/bash
set -ex

# Clear the environment
rm -rf app.$TEAMSFX_ENV.zip
rm -rf node_modules
rm -rf package-lock.json
# rm -rf appPackage/build
rm -rf lib
rm -rf .env
rm -rf tsconfig.tsbuildinfo

echo "TEAMSFX_ENV: $TEAMSFX_ENV"

docker rmi app-builder-linux || true

docker build --platform linux/amd64 -f Dockerfile_linux.build -t app-builder-linux . || exit 1

az login --service-principal -u $clientId \
    -p $clientSecret \
    --tenant $tenantId

# docker run --rm \
#     -v $(pwd):/app \
#     -v ~/.azure:/root/.azure \
#     app-builder-linux "teamsapp provision --env $TEAMSFX_ENV -i false"

docker run --rm \
    --platform linux/amd64 \
    -v $(pwd):/app \
    -v ~/.azure:/root/.azure \
    app-builder-linux "teamsapp deploy --env $TEAMSFX_ENV -i false"

# Create a startup script
cat > startup.sh <<'EOF'
#!/bin/bash
cd /home/site/wwwroot
node lib/index.js
EOF
chmod +x startup.sh

# Add the startup script to the app package
export WORKSPACE_DIR="."
export ZIP_FILE="app.$TEAMSFX_ENV.zip"

cp ./env/.env.$TEAMSFX_ENV $WORKSPACE_DIR/.env

zip -r $ZIP_FILE \
    $WORKSPACE_DIR/node_modules/ \
    $WORKSPACE_DIR/lib/ \
    $WORKSPACE_DIR/.env \
    $WORKSPACE_DIR/startup.sh

# Upload the app package to the Azure App Service
az webapp deploy \
    --resource-group $resourceGroup \
    --type zip \
    --name "commandbotdev" \
    --src-path $ZIP_FILE

rm -rf .env