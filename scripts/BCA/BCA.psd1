@{
    ModuleVersion     = '1.0.0'
    GUID              = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    Author            = 'Black Coffee Administration'
    Description       = 'Funciones PowerShell para instalar, configurar y abrir enlaces de BCA en Windows.'
    PowerShellVersion = '5.1'
    RootModule        = 'BCA.psm1'
    FunctionsToExport = @(
        'Get-BCAProjectRoot',
        'Get-BCAConfig',
        'Write-BCAStatus',
        'Update-BCAPathEnvironment',
        'Test-BCACommand',
        'Sync-BCARepository',
        'Initialize-BCAEnvFile',
        'Import-BCAEnvFile',
        'Get-BCAFirebaseField',
        'Install-BCADependencies',
        'Set-BCAGitHubSecrets',
        'Get-BCAFirebaseToken',
        'Deploy-BCAFirebase',
        'Start-BCAGitHubWorkflow',
        'Open-BCAUrl',
        'Open-BCAEnlaces',
        'New-BCADesktopShortcut',
        'Install-BCADesktopShortcuts',
        'Install-BCAProject',
        'Start-BCASetup'
    )
}
