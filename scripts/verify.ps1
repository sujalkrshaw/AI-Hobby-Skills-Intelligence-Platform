$ErrorActionPreference = 'Stop'
Write-Host '== SkillForge AI verification ==' -ForegroundColor Cyan
Write-Host '1/5 Checking Docker...' -ForegroundColor Yellow
docker --version
docker compose version
Write-Host '2/5 Checking Compose configuration...' -ForegroundColor Yellow
docker compose config | Out-Null
Write-Host '3/5 Building containers...' -ForegroundColor Yellow
docker compose build
Write-Host '4/5 Starting services...' -ForegroundColor Yellow
docker compose up -d
Start-Sleep -Seconds 12
Write-Host '5/5 Checking API health and tests...' -ForegroundColor Yellow
Invoke-RestMethod http://localhost:8000/health | ConvertTo-Json

docker compose exec -T backend pytest -q
Write-Host ''
Write-Host 'Verification completed.' -ForegroundColor Green
Write-Host 'Open http://localhost:5173 and sign in with demo@example.com / Demo@12345'
