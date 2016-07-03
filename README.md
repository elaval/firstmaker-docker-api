# firstmaker-docker-api

Docker source to build a REST APi server used to manage Firstmakers Backend services

## Building the docker image
$ docker build -t username/imagename .

## Running the docker image
### Using insecure http port 
```
docker run -d -p 8080:8080 -e JWT_SECRET="Secret phrase to interpret JWT token" \
-e MONGO_DATABASE="mongodb://mongodb.url:27017/dbname"  \
-v /host/path/data/db:/data/db username/image
```
### Using secure https port
```
docker run -d -p 443:443 -e JWT_SECRET="Secret phrase to interpret JWT token" \
-e MONGO_DATABASE="mongodb://mongodb.url:27017/dbname"  \
-e USE_HTTPS="TRUE" \
-v /host/path/certs:/root/certs \
-v /host/path/data/db:/data/db username/image
```

Most API calls require a jwt token which can be obtained by authenticated users

```
POST /api/authenticate
Required params: 
- email
- password

Response:
{
  "success": true,
  "message": "Enjoy your token!",
  "token": "ey ...."
}
```
