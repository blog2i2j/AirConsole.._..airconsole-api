pipeline {
    agent any
    options { disableConcurrentBuilds() }
    stages {
        stage('Install dependencies') {
            steps {
                nodejs(nodeJSInstallationName: 'Base') {
                    sh 'cd ci && pnpm install && npx playwright install chromium'
                }
            }
        }
        stage('Run Tests') {
            steps {
                nodejs(nodeJSInstallationName: 'Base') {
                    sh 'cd ci && npx playwright test --project chromium'
                }
            }
        }
    }
}
