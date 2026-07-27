pipeline {
    agent any

    environment {
        // Defines the name of your Docker image dynamically based on the directory name
        IMAGE_NAME = "gym-${env.JOB_BASE_NAME.toLowerCase()}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Lint Code') {
            steps {
                // Runs code quality check, skips if script doesn't exist in package.json
                sh 'npm run lint --if-present'
            }
        }

        stage('Run Tests') {
            steps {
                // Runs unit and integration test suite
                sh 'npm test --if-present'
            }
        }

        stage('Build Docker Image') {
            steps {
                // Builds the multi-stage production Docker image
                sh "docker build -t ${IMAGE_NAME}:${env.BUILD_NUMBER} ."
                sh "docker build -t ${IMAGE_NAME}:latest ."
            }
        }
    }

    post {
        always {
            // Standard cleanup step to prevent workspace bloat on the Jenkins runner
            cleanWs()
        }
        success {
            echo "CI pipeline completed successfully for build #${env.BUILD_NUMBER}!"
        }
        failure {
            echo "Pipeline failed on build #${env.BUILD_NUMBER}. Check console logs above."
        }
    }
}