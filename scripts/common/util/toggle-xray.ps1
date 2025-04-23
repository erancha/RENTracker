param(
    [string]$Action
)

if (-not $Action -or ($Action -ne 'on' -and $Action -ne 'off')) {
    Write-Host "Usage: .\toggle-xray.ps1 -Action <on|off>"
    exit 1
}

# Determine the tracing mode based on the action
$TracingMode = if ($Action -eq 'on') { 'Active' } else { 'PassThrough' }
$TracingEnabled = if ($Action -eq 'on') { 'true' } else { 'false' }

# Update tracing for all Lambda functions
Write-Host "Updating tracing for all Lambda functions to $TracingMode..."
$LambdaFunctions = aws lambda list-functions --query 'Functions[*].FunctionName' --output text
foreach ($Function in $LambdaFunctions) {
    Write-Host "Updating Lambda function: $Function"
    aws lambda update-function-configuration --function-name $Function --tracing-config Mode=$TracingMode
}

# Update tracing for all API Gateway stages
Write-Host "Updating tracing for all API Gateway stages to $TracingEnabled..."
$RestApis = aws apigateway get-rest-apis --query 'items[*].id' --output text
foreach ($ApiId in $RestApis) {
    $Stages = aws apigateway get-stages --rest-api-id $ApiId --query 'item[*].stageName' --output text
    foreach ($Stage in $Stages) {
        Write-Host "Updating API Gateway stage: $ApiId/$Stage"
        aws apigateway update-stage --rest-api-id $ApiId --stage-name $Stage --patch-operations op=replace,path=/tracingEnabled,value=$TracingEnabled
    }
}

# Update tracing for DynamoDB tables (CloudWatch Contributor Insights)
Write-Host "Updating Contributor Insights for all DynamoDB tables to $Action..."
$DynamoDBTables = aws dynamodb list-tables --query 'TableNames[*]' --output text
foreach ($Table in $DynamoDBTables) {
    Write-Host "Updating DynamoDB table: $Table"
    if ($Action -eq 'on') {
        aws dynamodb enable-contributor-insights --table-name $Table
    } else {
        aws dynamodb disable-contributor-insights --table-name $Table
    }
}

Write-Host "X-Ray tracing has been turned $Action for all resources."