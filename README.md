# Geolocation Challenge

A simple API to locate given addresses via Googe Geolocation API, accompanied by a small, ugly and incomplete UI written with HAML.

## Setup

### Config

Configuration should not be stored, and should be integrated into the deploy pipeline.

A minimal `config/config.json` should read: `{ "google": { "apikey":"AIzaSyDqNwz_vvYfa1YNMfsLIUEf855BOt_TdaE" } }`

The default settings can be found in `config/index.js`, and should be masked using `config/config.json` (git ignored).

### Entrypoint

`npm start` or `node server.js` to run.

## Routes

### GET / - Main page

404s redirect here. Default UI page.

### POST /api - Create request

Accepts JSON array in form `[ {name: ,address:} ... ]`.

```
{
    status:
    request:{
        id:
        type:
        start:
        status:
        percent:
        children:
        numComplete:
        numChildren:
    }
}
```

### GET /api/:id - Get request info

Returns JSON containing the matching request or `{err:"Record not found"}`

```
{
    id:
    type:
    start:
    status:
    percent:
    children:
    numComplete:
    numChildren:
}
```

## Database Schemas

### Location

```
    type:"location",
    status: SEE BELOW,
    location: "lat,lng",
    name: User provided,
    address: User Provided
```

### Request

```
    id: Unique key,
    type: 'request',
    status: SEE BELOW,
    start: Time of request,
    children: Array of _id,
    numComplete: Children ready,
    numChildren: Length children,
```

## Status Codes

0:error - The resource will be neglected.

1:pending - The resource has not been used.

2:ready - The resource was updated sucessfully.

## Known Bugs

Tests are not set up

Dockerfile not included

CSS on front page could use polish

Possible to determine names used for addresses if any by querying after they are populated, due to indexing
