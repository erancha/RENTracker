# Deploy ECS stack                          :   ./deploy-undeploy-ecs.ps1 -action deploy
# Deploy without rebuilding Docker image    :   ./deploy-undeploy-ecs.ps1 -skipDockerBuildAndPush $true
# Undeploy ECS stack                        :   ./deploy-undeploy-ecs.ps1 -action undeploy
param(
    [Parameter(Mandatory = $false)]
    [string]$action = "deploy", # deploy, undeploy

    [Parameter(Mandatory = $false)]
    [bool]$skipDockerBuildAndPush = $false
)

$ErrorActionPreference = "Stop"

$originalLocation = Get-Location
try {
    Set-Location $PSScriptRoot
    $scriptName = Split-Path -Leaf $PSCommandPath

    . ./common/util/get-ElapsedTimeFormatted.ps1
    $startTime = Get-Date

    $commonConstants = ./common/constants.ps1

    $THIS_TEMPLATE_FILE = "template-ecs.yaml"
    $THIS_STACK_NAME = "$($commonConstants.stackName)-ecs"

    if ($action -eq "deploy") {
        $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
        Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Validating template ..."
        sam validate --lint --template-file $THIS_TEMPLATE_FILE

        $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
        Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : sam build --template-file $THIS_TEMPLATE_FILE ..`n"
        sam build --region $commonConstants.region --template-file $THIS_TEMPLATE_FILE
        if ($LASTEXITCODE -eq 0) {
            # Build and push Docker image to ECR
            $apartmentId = aws sts get-caller-identity --query "Apartment" --output text
            $ecrRentTrackingRepositoryName = "rentTracking-repository"
            $rentTrackingServiceName = "RenTracker-service"
            $rentTrackingDockerResults = ./common/dev-build-push-docker-image.ps1 `
                -skipDockerBuildAndPush $skipDockerBuildAndPush `
                -apartmentId $apartmentId `
                -ecrRepositoryName $ecrRentTrackingRepositoryName `
                -serviceName $rentTrackingServiceName

            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Build completed. Deploying .."

            # Get outputs from the main stack for use as parameters
            $mainStackOutputs = ./common/get-stack-outputs.ps1
            $rdsEndpoint = ($mainStackOutputs | Where-Object { $_.OutputKey -eq "MyRDSEndpoint" }).OutputValue
            $rdsSecurityGroupId = ($mainStackOutputs | Where-Object { $_.OutputKey -eq "MyRDSSecurityGroupId" }).OutputValue

            # Build the parameter overrides string dynamically
            $parameterOverrides = @(
                "ExistingVpcId='vpc-08016eb77e7ac9962'", # en-VPC
                "ExistingIgwId='igw-0fd7e050083dec0b9'", # en-IGW
                "ExistingUserPoolId='eu-central-1_OHq1aZYju'", # en-UserPool
                "ExistingElasticacheRedisClusterAddress='en-elasticache-redis-cluster.hz2zez.0001.euc1.cache.amazonaws.com:6379'", # https://eu-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools/eu-central-1_OHq1aZYju/branding/domain?region=eu-central-1
                "RentTrackingServiceName='$rentTrackingServiceName'",
                "RentTrackingTaskEcrImageUri='$($rentTrackingDockerResults.ecrImageUri)'",
                "ExistingRDSEndpoint='$rdsEndpoint'",
                "ExistingRDSSecurityGroupId='$rdsSecurityGroupId'"
            )

            $parameterOverridesString = $parameterOverrides -join " "

            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : sam deploy --template-file $THIS_TEMPLATE_FILE --stack-name $THIS_STACK_NAME --parameter-overrides $parameterOverridesString ..`n"
            sam deploy --region $commonConstants.region `
                --template-file $THIS_TEMPLATE_FILE `
                --stack-name $THIS_STACK_NAME `
                --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND `
                --parameter-overrides $parameterOverridesString `
                --no-fail-on-empty-changeset

            if ($LASTEXITCODE -eq 0) {
                $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
                Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Deployment completed successfully." -ForegroundColor Green

                # TODO: The deployment of the ecs service (sam deploy, above) is stuck in infinite loop during startup without the following two lines
                $thisStackOutputs = aws cloudformation describe-stacks --stack-name $THIS_STACK_NAME --region $commonConstants.region --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
                Push-Location common
                ./add-sg-to-sg.ps1 -mySGName "MyECSServicesSG" -targetSGId 'sg-0c5868829116d3628' -port 6379 -stackOutputs $thisStackOutputs # TODO: --> constants.ps1 : $elasticacheSGId
                ./add-sg-to-sg.ps1 -mySGName "MyECSServicesSG" -targetSGId 'sg-0280f7af5f31cb24d' -port 5432 -stackOutputs $thisStackOutputs # TODO: --> constants.ps1 : $rdsSGId
                Pop-Location

                # Run tests if needed
                ./update-postman-collection.ps1 -stackOutputs $thisStackOutputs
                # ./test-web-api.ps1 -stackOutputs $thisStackOutputs -parallelCount 5 -iterationsCount 10

                # Update appConfig.json's REST_API_URL with LoadBalancerURL
                $loadBalancerUrl = ($thisStackOutputs | Where-Object { $_.OutputKey -eq 'LoadBalancerURL' }).OutputValue
                if ($loadBalancerUrl) {
                    $appConfigPath = "../frontend/src/appConfig.json"
                    $appConfig = Get-Content $appConfigPath | ConvertFrom-Json
                    
                    # Save original REST_API_URL as API_GW_REST_API_URL if not already set
                    if (-not $appConfig.API_GW_REST_API_URL) {
                        $appConfig | Add-Member -NotePropertyName "API_GW_REST_API_URL" -NotePropertyValue $appConfig.REST_API_URL
                    }
                    
                    $appConfig.REST_API_URL = "$loadBalancerUrl/api/crud"
                    $appConfig | ConvertTo-Json -Depth 10 | Set-Content $appConfigPath
                    Write-Host "Updated appConfig.json:"
                    Write-Host "  API Gateway URL: $($appConfig.API_GW_REST_API_URL)"
                    Write-Host "  LoadBalancer URL: $($appConfig.REST_API_URL)"
                }
            }
            else {
                throw "Deployment failed."
            }
        }
        else {
            throw "Build failed."
        }
    }
    elseif ($action -eq "undeploy") {
        $thisStackOutputs = aws cloudformation describe-stacks --stack-name $THIS_STACK_NAME --region $commonConstants.region --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
        Push-Location common
        ./remove-sg-from-sg.ps1 -mySGName "MyECSServicesSG" -targetSGId 'sg-0c5868829116d3628' -port 6379 -stackOutputs $thisStackOutputs # TODO: --> constants.ps1 : $elasticacheSGId
        ./remove-sg-from-sg.ps1 -mySGName "MyECSServicesSG" -targetSGId 'sg-0280f7af5f31cb24d' -port 5432 -stackOutputs $thisStackOutputs  # TODO: --> constants.ps1 : $rdsSGId
        Pop-Location

        $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
        Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Undeploying stack $THIS_STACK_NAME ..."
        aws cloudformation delete-stack --stack-name $THIS_STACK_NAME --region $commonConstants.region
        Write-Host "Waiting for stack deletion to complete ..."
        aws cloudformation wait stack-delete-complete --stack-name $THIS_STACK_NAME --region $commonConstants.region
        Write-Host "Stack deletion completed." -ForegroundColor Green
    }
    else {
        throw "Invalid action: $action. Must be either 'deploy' or 'undeploy'."
    }

    $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Completed $scriptName." -ForegroundColor Blue
}
catch {
    Write-Host "An error occurred: $_" -ForegroundColor Red
    exit 1
}
finally {
    Set-Location $originalLocation
}