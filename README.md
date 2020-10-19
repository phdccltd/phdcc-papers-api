# phdcc-papers-api

API for the **Papers** [PHDCC journal/conference abstract and paper submission and review system](https://www.phdcc.com/papers/).

This API is intended for use in conjunction with [phdcc-papers](https://github.com/phdccltd/phdcc-papers).

This nodejs API code should set up to listen for web requests on an internal port.
The public-facing server for a website will use a proxy to pass requests at `/api` to the API port.
Here is an example Apache conf for the API and the main website [phdcc-papers](https://github.com/phdccltd/phdcc-papers).

```<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName example.com
    ServerAdmin admin@example.com
    ErrorLog ${APACHE_LOG_DIR}/error.log
    LogLevel warn
    CustomLog ${APACHE_LOG_DIR}/access.log combined

    ProxyRequests off

    <Proxy *>
      Order deny,allow
      Allow from all
    </Proxy>

    ProxyPass /api/ http://localhost:1234/
    ProxyPassReverse /api/ http://localhost:1234/
    ProxyPass / http://localhost:4321/
    ProxyPassReverse / http://localhost:4321/
    ProxyPreserveHost On

SSLCertificateFile /etc/letsencrypt/live/example.com/fullchain.pem
SSLCertificateKeyFile /etc/letsencrypt/live/example.com/privkey.pem
Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
```


Create a `.env` text file with the following secrets

```
PORT=portno
DATABASE='dbname'
DBUSER='dbuser'
DBPASS='dbpassword'
LOGSQL=false - set to true if you want all sequelize SQL logged
LOGMODE=console - if you want logger output to the console
BASEURL=/api
JWT_SECRET='Secret used in authentication'
RECAPTCHA_SECRET_KEY='recaptcha secret key'
RECAPTCHA_BYPASS='Password to avoid recaptcha'
```


## Build Setup

```bash
# install dependencies
$ npm install

# serve with hot reload at localhost port defined above
$ npm run dev

# build for production and launch server
$ npm run build
$ npm run start

# generate static project
$ npm run generate
```
