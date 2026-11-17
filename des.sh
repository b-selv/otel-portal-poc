#!/bin/bash
aws ecs describe-tasks \
  --cluster intrepid-flamingo-0g6uqz \
  --tasks $(aws ecs list-tasks --cluster intrepid-flamingo-0g6uqz --service-name api-portal-service-serverless --region ap-southeast-1 --query 'taskArns[0]' --output text) \
  --region ap-southeast-1 \
  --query 'tasks[0].{taskDef:taskDefinitionArn,lastStatus:lastStatus}'
