# Geolocation Challenge

A simple API to locate given addresses via Googe Geolocation API, accompanied by a small, ugly and incomplete UI written with HAML.

## Setup

### Config

Configuration should not be stored, and should be integrated into the deploy pipeline.

The default settings can be found in `config/index.js`, and should be masked using `config/config.json` (git ignored).

### Entrypoint

`npm start` or `node server.js` to run.

## Routes

### GET / - Main page

404s redirect here. Default UI page.

### POST /api - Create request

Accepts JSON array in form `[ {name: ,address:} ... ]`.

### GET /api/:id - Get request info

Returns JSON containing the matching request or `{err:"Record not found"}`

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
    message: 'Started.',
    start: Time of request,
    children: Array of _id,
    numChildren: Length children,
```

## Status Codes

0:error - The resource will be neglected.

1:pending - The resource has not been used.

2:ready - The resource was updated sucessfully.

## Known Bugs

Tests are not set up

Dockerfile not included

Map missing on frontend page

Might throw error rather than prune if input contains duplicates
