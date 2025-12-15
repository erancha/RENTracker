param (
    [bool]$prepareForFrontend
)

Push-Location $PSScriptRoot
try {
    $scriptName = Split-Path -Leaf $PSCommandPath

    . ./common/util/get-ElapsedTimeFormatted.ps1
    $startTime = Get-Date
    $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : $scriptName ..." -ForegroundColor White -BackgroundColor DarkBlue

    $commonConstants = ./common/constants.ps1
    Set-Variable -Name 'TEMPLATE_FILE' -Value "$PSScriptRoot/template.yaml" -Option Constant 

    $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Validating the cloudformation template .."
    sam validate --region $commonConstants.region --template-file $TEMPLATE_FILE --lint # | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() }
    if ($LASTEXITCODE -eq 0) {
        $skipFixedLambdaLayers = $true
        $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
        if ($skipFixedLambdaLayers) {
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Skipping lambda layers !" -ForegroundColor Yellow -BackgroundColor DarkGreen
        }
        else {
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Preparing lambda layers .."
            $appFolder = (Split-Path $PSScriptRoot -Parent)
            $folderBeforeLayers = Get-Location

            Push-Location "${appFolder}/backend/RenTracker-service/ecs/layers/redisClient/"
            npm install
            Pop-Location

            Push-Location "${appFolder}/backend/RenTracker-service/ecs/layers/dbData/"
            npm install
            Pop-Location

            Push-Location "${appFolder}/backend/layers/document-utils/"
            npm install
            Pop-Location

            Set-Location $folderBeforeLayers
        }

        $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
        Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : sam build --template-file $TEMPLATE_FILE ..`n"
        sam build --region $commonConstants.region --template-file $TEMPLATE_FILE # > $null
        if ($LASTEXITCODE -eq 0) {
            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Build completed. Deploying .."

            # Build the parameter overrides string dynamically
            $accountId = aws sts get-caller-identity --query "Account" --output text

            # Shared parameter overrides (FFU for both accounts)
            $sharedParameterOverrides = @(
                # "DisableAppCache='true'",
                # "TargetChattyLambdaArn='arn:aws:lambda:eu-central-1:575491442067:function:cht-GenericWebsocketReceiverFunction-OWfDNLjFGPdu'"
            )

            $accountParameterOverrides = @(
                "ExistingUserPoolId='eu-central-1_AGzi24ZGD'",                                      # vsdb-cognito
                "ExistingCognitoDomain='vsdb-306783770944.auth.eu-central-1.amazoncognito.com'",    # vsdb-cognito (note: added to https://console.cloud.google.com/auth/clients?authuser=1&inv=1&invt=Ab2COw&project=neural-engine-437616-s8)
                "ExistingRedisAddress='ec2-18-156-129-121.eu-central-1.compute.amazonaws.com'",     # vsdb
                "ExistingRedisPassword='vsdb-redis'",                                               # vsdb  TODO: Use Secrets Manager
                "ExistingPrivateSubnetAppId='subnet-0326908018aa6fee0'",                            # vsdb-fb
                "ExistingAppSGId='sg-029a3b380411664ed'",                                           # vsdb-fb
                # Lambda Layer ARNs
                "ExistingAwsSdkV3LayerArn='arn:aws:lambda:$($commonConstants.region):${accountId}:layer:AwsSdkV3Layer:15'",
                "ExistingCorsHeadersLayerArn='arn:aws:lambda:$($commonConstants.region):${accountId}:layer:CorsHeadersLayer:8'",
                "ExistingRedisClientLayerArn='arn:aws:lambda:$($commonConstants.region):${accountId}:layer:skl-RedisClientLayer:1'",
                "ExistingWebsocketsConnectionsLayerArn='arn:aws:lambda:$($commonConstants.region):${accountId}:layer:skl-WebsocketsConnectionsLayer:1'",
                "ExistingCommandsHandlersLayerArn='arn:aws:lambda:$($commonConstants.region):${accountId}:layer:rntrk-CommandsHandlersLayer:1'",
                "ExistingDbDataLayerArn='arn:aws:lambda:$($commonConstants.region):${accountId}:layer:rntrk-DbDataLayer:1'",
                "ExistingDocumentUtilsLayerArn='arn:aws:lambda:$($commonConstants.region):${accountId}:layer:rntrk-DocumentUtilsLayer:1'"
            )

            $parameterOverrides = $sharedParameterOverrides + $accountParameterOverrides

            if ($commonConstants.isMainBranch) {
                $parameterOverrides += "StageName='prod'"
                $parameterOverrides += "RetainResourcesOnDelete='true'"
            }
            else {
                # $parameterOverrides += "EnableAdditionalMetrics='true'" # TODO: In actual production, these metrics will be more relevant than during development ..
            }

            # Join the parameter overrides into a single string
            $parameterOverridesString = $parameterOverrides -join " "

            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Starting a deployment, stack '$($commonConstants.stackName)' .."
            sam deploy --region $commonConstants.region --template-file $TEMPLATE_FILE --stack-name $commonConstants.stackName `
                --capabilities CAPABILITY_IAM `
                --fail-on-empty-changeset false `
                --resolve-s3 `
                --parameter-overrides $parameterOverridesString
            # --force-upload `
            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            if (($LASTEXITCODE -ne 0) -and ($LASTEXITCODE -ne 1)) {
                Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Deployment failed with exit code ${LASTEXITCODE}."
            }
            else {
                if ($LASTEXITCODE -eq 1) {
                    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Deployment completed with no changes to deploy. Stack '$($commonConstants.stackName)' is up to date."
                }
                else {
                    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Deployment completed successfully." -ForegroundColor Green

                    # $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
                    # Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Attaching MyAppSG to elasticache's and RDS' SGs ..."
                    # Push-Location common
                    # ./add-sg-to-sg.ps1 -mySGName "MyAppSG" -targetSGId 'sg-0c5868829116d3628' -port 6379 # TODO: --> constants.ps1 : $elasticacheSGId
                    # ./add-sg-to-sg.ps1 -mySGName "MyAppSG" -targetSGId 'sg-0280f7af5f31cb24d' -port 5432 # TODO: --> constants.ps1 : $rdsSGId
                    # Pop-Location
                }

                if ($prepareForFrontend) {
                    ./common/update-app-config-dev.ps1
                }
            }
        }
        else {
            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : SAM build failed."
        }
    }

    $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Completed $scriptName." -ForegroundColor Blue
}
finally {
    Pop-Location
}