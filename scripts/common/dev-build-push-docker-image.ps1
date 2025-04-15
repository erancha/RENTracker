param (
   [bool]$skipDockerBuildAndPush = $false,

   [Parameter(Mandatory = $true)]
   [string]$apartmentId,

   [Parameter(Mandatory = $true)]
   [string]$ecrRepositoryName,

   [Parameter(Mandatory = $true)]
   [string]$serviceName
)

$originalLocation = Get-Location
try {
    Set-Location $PSScriptRoot
    $scriptName = Split-Path -Leaf $PSCommandPath

    . ./util/get-ElapsedTimeFormatted.ps1
   $startTime = Get-Date
   $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
   Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : $scriptName ..." -ForegroundColor White -BackgroundColor DarkBlue

   # Configuration
   $commonConstants = ./constants.ps1
   $imageTag = Get-Date -Format "yyyyMMdd-HHmm" # "latest" # 
   $ecrUri = "${apartmentId}.dkr.ecr.$($commonConstants.region).amazonaws.com"
   $ecrImageUri = "${ecrUri}/${ecrRepositoryName}:${imageTag}"
   $latestImageUri = "${ecrUri}/${ecrRepositoryName}:latest"

   if ($skipDockerBuildAndPush) {
      Write-Host "Skipping docker build and push !" -ForegroundColor Yellow -BackgroundColor DarkGreen
      $returnValues = @{ ecrImageUri = $latestImageUri }
   }
   else {
      $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
      Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Building and pushing Docker image(s) for service: $serviceName..."

      # Check if Docker Desktop is running
      $dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
      if (!$dockerProcess) {
          Write-Host "Docker Desktop is not running. Starting it now..."
          Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
          
          # Wait for Docker to be ready
          $retryCount = 0
          $maxRetries = 30  # 30 x 2 seconds = 60 seconds max wait time
          
          do {
              Start-Sleep -Seconds 2
              $retryCount++
              Write-Host "Waiting for Docker to be ready... ($retryCount/$maxRetries)"
              
              $dockerInfo = docker info 2>&1
              $dockerReady = $LASTEXITCODE -eq 0
              
              if ($retryCount -ge $maxRetries) {
                  throw "Timeout waiting for Docker to start. Please ensure Docker Desktop is installed and can start properly."
              }
          } while (!$dockerReady)
          
          Write-Host "Docker Desktop is now running and ready."
      }

      # Build Docker image
      $scriptsFolder = (Get-Location).Path
      Set-Location "${scriptsFolder}/../../backend/${serviceName}/ecs"
      $lowerServiceName = $serviceName.ToLower()
      docker build -t "${lowerServiceName}:${imageTag}" .
      Set-Location ${scriptsFolder}

      # Authenticate with ECR
      $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
      Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Authenticating with ECR..."
      aws ecr get-login-password --region $commonConstants.region | docker login --username AWS --password-stdin $ecrUri

      # Create ECR repository if it doesn't exist
      $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
      Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Ensuring ECR repository exists..."
      $repositoryExists = aws ecr describe-repositories --repository-names $ecrRepositoryName --region $commonConstants.region 2>$null
      if ($LASTEXITCODE -ne 0) {
         Write-Host "Creating ECR repository..."
         aws ecr create-repository --repository-name $ecrRepositoryName --region $commonConstants.region
      }

      # Tag and push image with time-based tag
      $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
      Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Tagging and pushing image $ecrImageUri ..."
      docker tag "${lowerServiceName}:${imageTag}" "$ecrImageUri"
      docker push "$ecrImageUri"

      # Tag and push image as "latest"
      $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
      Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Tagging and pushing image $latestImageUri ..."
      docker tag "${lowerServiceName}:${imageTag}" "$latestImageUri"
      docker push "$latestImageUri"

      $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
      Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Completed. Images pushed successfully to ECR."

      $returnValues = @{ ecrImageUri = $ecrImageUri }
   }

   return $returnValues
}
finally {
    Set-Location $originalLocation
}
