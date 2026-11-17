#!/bin/bash
docker buildx build --platform linux/amd64 --push -t 601625517010.dkr.ecr.ap-southeast-1.amazonaws.com/api-developer-portal:0.1.0 .
