# phdcc-papers-api

<!--[![Build Status](https://api.travis-ci.com/phdccltd/phdcc-papers-api.svg?branch=main)](https://travis-ci.com/github/phdccltd/phdcc-papers-api)-->
[![CircleCI](https://circleci.com/gh/phdccltd/phdcc-papers-api.svg?style=shield)](https://circleci.com/gh/phdccltd/phdcc-papers-api)
[![Coverage Status](https://coveralls.io/repos/github/phdccltd/phdcc-papers-api/badge.svg?branch=main)](https://coveralls.io/github/phdccltd/phdcc-papers-api?branch=main)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Dependencies](https://david-dm.org/phdccltd/phdcc-papers-api.svg)](https://david-dm.org/phdccltd/phdcc-papers-api)
<a href="https://sonarcloud.io/dashboard?id=phdccltd_phdcc-papers-api"><img src="https://sonarcloud.io/images/project_badges/sonarcloud-white.svg" height="20" alt="SonarCloud" ></a>

API for the **Papers** [PHDCC journal/conference abstract and paper submission and review system](https://www.phdcc.com/papers/).

JCchange to JCtwigA
JCchange to JCtwigA offline at 13:04


This API is intended for use in conjunction with [phdcc-papers](https://github.com/phdccltd/phdcc-papers).

## State of Play

The Papers system is in production use. However there is currently no admin interface to set up the system. This will be created in due course. 
In the mean time please contact us at https://phdcc.com/feedback.html for help.

## Base usage

The following commands will get and run the API code. However before running you need to configure a database and set various environment variables - see below.

```
# Grab the code
git clone https://github.com/phdccltd/phdcc-papers-api.git
cd phdcc-papers-api

# Install dependencies
npm install

# Serve with hot reload at localhost port defined above
npm run dev

# For simple production use:
npm run start

# For production in PM2, create an ecosystem file or start an instance like this:
pm2 start server.js --name papersapi
```

A similar (but slightly different) setup process is needed for the client code server
[phdcc-papers](https://github.com/phdccltd/phdcc-papers).

## Terms of use and Privacy

If setting Papers up on your own server, you need to configure a "Terms of use" site page to list terms which the user must agree to on the register page,
along with details of how their personal information is kept secret and shared eg to reviewers.

## Requirements

* nodejs, including npm and git
* Front end server eg apache or nginx, typically with Let's Encrypt SSL support
* MySQL or similar database
* Process manager such as pm2
* mail send capability, either sendmail or SMTP
* Google recaptcha keys
* A directory for each of the two Papers components and a separate files directory to store users' submitted documents
* API access to the /tmp file storage system: a sub-directory `papers` is used

In addition, taking regular database backups is recommended, eg daily. The separate files directory should also be backed up.

## Database

Running this API component will automatically create and update the required tables in the database specified by the environment variables.
A fresh install currently needs data added to various database tables to get the site running.

## Configuration

The Papers system has two components: an API server and a client code server. The client code runs in the user's browser and makes calls to the API server. 
Typically both are at the same host eg https://papers.example.org, with the API responding to calls to https://papers.example.org/api and the client responding to all
other requests.

The core system setup is done by specifying values in `.env` files for both components. Other configuration parameters are specified in the `sites` database table.

Note that this API runs a background task which will send out reminder mails as and when necessary.

Various API logs are stored:
* in the `logs` database table
* in the `log` sub-directory - the file `log/papersapp.log` contains the latest output. The [rotating-file-stream](https://www.npmjs.com/package/rotating-file-stream) package 
is used to rename the log file on a daily basis; best used in conjunction with a daily restart of all PM2 processes. Old logs are currently not deleted.
* in the PM2 `logs` folder, with 'out' and 'error' logs for both the 'papers' and 'papersapi' PM2 processes.

## PM2 process manager

In production use, a process manager such as [PM2](https://pm2.keymetrics.io/docs/usage/pm2-doc-single-page/) should be used to ensure that the 
two Papers components are up and running.  
An [ecosystem file](https://pm2.keymetrics.io/docs/usage/application-declaration/) is the best solution. Alternatively, as described here,
you can start individual processes  and then save the configuration so the processes are restarted after a reboot.

In the papers directory create a `runpapers.sh` file:

```
./node_modules/.bin/cross-env PORT=1234 node .output/server/index.mjs
```


```
cd /var/www/papersapi
pm2 start server.js --name papersapi

cd /var/www/papers
npm run build
pm2 start runpapers.sh --name papers -- start

pm2 save
```

Test that the processes restart after rebooting.
Typically, both Papers components are configured to send a mail when they restart.

You can see what processes are running using the command `pm2 ps`. 
If need be, you can stop and start named apps eg `pm2 stop papersapi`, `pm2 restart papers`, etc.

To allow for log file recycling, you can ask PM2 to restart all processes once a day using a [crontab](https://linuxhandbook.com/crontab/) entry, eg overnight.
List your current crontab table using `crontab -l`. Use `crontab -e` to edit your crontab table. 
This crontab line restarts all PM2 processes at 03:17 every day, server-time:

```
17 3 * * * /usr/bin/node /usr/local/bin/pm2 restart all >/dev/null 2>/dev/null
```

Check that the command actually works first, ie do `/usr/bin/node /usr/local/bin/pm2 restart all`. Use `whereis pm2` to find its location.

Note that papers can be run as a static website instead of being served by pm2 and node - [phdcc-papers](https://github.com/phdccltd/phdcc-papers#user-content-run-as-static-website).

## Code updates

Updates to the two Papers components may be issued separately or together.
If there are updates to both, then it is best to update both at the same time to avoid any discrepancies.
Restarting the API component will perform any required database updates.
Please read the release notes before any major updates; taking a database backup is recommended.

Typical full update process:
```
pm2 stop papersapi
pm2 stop papers

cd /var/www/papersapi
git pull
npm install
pm2 start papersapi

cd /var/www/papers
git pull
rm package-lock.json
rm -r node_modules
npm install
npm run build
pm2 start papers
```

## npm updates and audit

The Papers components uses external packages which are likely to be updated every so often, sometimes with security updates.
The above update process will safely bring in any package updates.

If need be, you use the `npm audit` command to check for any security vulnerabilities.
It may advise that `npm audit fix` will fix these.
Running `npm update` is another way of updating all packages.
The Papers repositories should be updated regularly; updated as in the previous section is usually best.

## Serving requests

The two Papers nodejs web components should be served by a non-root user on the system, 
each responding on an internal port that is not exposed publicly.
A public-facing web server such as apache or nginx will act as the public interface,
proxying requests to the relevant component via the internal ports.
The public-facing server should deal with redirects to HTTPS and SSL certificates.

The instructions below are for Apache. Here's a link to [instructions for nginx](https://pm2.keymetrics.io/docs/tutorials/pm2-nginx-production-setup) for one port.

This Apache conf file sends API requests at `/api` to internal port 1234 and any other requests to port 1235.
Let's Encrypt certificates are in use. 
Note that you may need to install the Apache modules `proxy` and `proxy_http`.

```
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName papers.example.org
    ServerAdmin admin@example.org
    ErrorLog ${APACHE_LOG_DIR}/error.log
    LogLevel warn
    CustomLog ${APACHE_LOG_DIR}/access.log combined

    ProxyRequests off

    <Proxy *>
      Require all granted
    </Proxy>

    ProxyPass /api/ http://localhost:1234/
    ProxyPassReverse /api/ http://localhost:1234/
    ProxyPass / http://localhost:1235/
    ProxyPassReverse / http://localhost:1235/
    ProxyPreserveHost On

    SSLCertificateFile /etc/letsencrypt/live/example.org/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/example.org/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
```

## Environment file .env

Create a `.env` text file in the root directory of the API component with the following secrets:

```
PORT=portno
DATABASE='dbname'
DBUSER='dbuser'
DBPASS='dbpassword'
LOGSQL=false - set to true if you want all sequelize SQL logged
LOGMODE=console - if you want logger output to the console
BASEURL=/api
JWT_SECRET='Some random secret characters for use in authentication'
RECAPTCHA_SECRET_KEY='recaptcha secret key'
RECAPTCHA_BYPASS='Password to avoid recaptcha'
```

*Note: any values you put in this .env file will not be sent to the user.*

## Used with thanks

Thanks to all the developers who produced the open-source modules that are used.

# Sponsors

This development has kindly been supported by 
[![IRCOBI](./docs/ircobi-picto.png)](http://ircobi.org/).

# License

[MIT](LICENCE)
