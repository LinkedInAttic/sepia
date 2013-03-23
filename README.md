# sepia

Sepia is a VCR-like module for node.js that records HTTP interactions, and
plays them back exactly like the first time they were invoked. Sepia was
created to isolate a server from its remote downstream dependencies, for speed
and fault-tolerence.

Sepia works with any HTTP library in node.js that uses `http#request` and
`https#request`, including [the `request`
module](https://github.com/mikeal/request).

## Quick Start

Install the module.

    npm install sepia

Plop it into your application:

    require('sepia');

Now, when you start your application, run it with the `VCR_MODE` environment
variable set to the correct value:

    npm start                   # no sepia
    VCR_MODE=record npm start   # sepia, in record mode
    VCR_MODE=playback npm start # sepia, in playback mode
    VCR_MODE=cache npm start    # sepia, in cache mode

## Examples

    cd sepia
    npm install
    time VCR_MODE=record npm test
    time VCR_MODE=playback npm test # notice it's much faster!

The example is located in `examples/example.js`. It exercises some of the
features of the module, and demonstrates that even requests made with the
`request` module are intercepted properly.

    cd sepia
    npm install
    rm -r fixtures # in case you had previously generated fixtures
    VCR_MODE=cache node examples/cache.js

This example demonstrates the cache mode, which makes a real HTTP request and
records it if the fixture does not exist, but then reuses the fixture if it
does exist. Notice that the first call takes about one second, whereas the
second call finishes quickly.

## Fixture Data

Fixture data generated during the recording phase are stored in files. By
default, the files are stored in `fixtures/generated` under the directory in
which the application was started. To override this:

    var sepia = require('sepia');
    sepia.fixtureDir(path.join(process.cwd(), 'sepia-fixtures'));

If this directory doesn't exist, it will be created.

## URL and Body Filtering

When determining which fixture file to record to, or read from during
playback, a filename is generated using each HTTP(S) request's URL, and the
request body, if present. The latter is used to differentiate between two POST
or PUT requests pointing to the same URL but differing only in the request
body.

Sometimes, a request contains data in the URL or the body that is necessary for
the successful execution of that request, but changes from repeated invocations
of that resource. One typical example is a timestamp; another is a uniquely
generated request ID. However, two requests that have all other parts of the
request aside from these parameters constant, the two requests should be
considered the same for recording and playback purposes.

To this end, a URL and body filtering functionality is provided. Suppose that
your tests make the following request:

    request('http://example.com/my-resource?time=' + Date.now(), next);

and while the `time` query parameter is required for the request to complete,
you want to playback the same data that was recorded, regardless of what
timestamp was used during recording and during playback. Use a URL filter:

    var sepia = require('sepia');
    sepia.filter({
      url: /my-resource/,
      urlFilter: function(url) {
        return url.replace(/time=[0-9]+/, '');
      }
    });

The `url` field is used to determine which requests should have `urlFilter`
applied to it. The matcher is a regex. The filter is only applied to determine
which fixture will be used; the actual request made to the remote resource
during recording is unchanged.

The filter specification can also contain a `bodyFilter` function that operates
on the request body. Either `urlFilter` or `bodyFilter` may be specified.

Multiple calls to `sepia#filter` may be made. All matching filters are applied
in the order they are specified.

## Limitations

### Repeated Identical HTTP Requests

If the same request returns different data during different invocations, sepia
has no way of differentiating between the two invocations. This can happen
when, for example, a resources is fetched using a `GET` request, it is
modified using a `PUT` request, and it is fetched once more using a `GET`
request to verify that it was updated successfully.

The Ruby implementation of [VCR](https://github.com/vcr/vcr) uses the concept
of a cassette. This concept does not apply here because sepia may run in a
completely separate process from the tests. The only way around this currently
is to actually make the requests different in some way.

For example, in an integration test scenario, you may be able to pass the name
of a test and a number (e.g. `testUpdate1` and `testUpdate2`) along with each
request made from the test. Typically, this would be passed as a query
parameter that would be ignored by the remote server.

## Technical Details

Sepia inspects the `VCR_MODE` environment variable. In record mode, sepia wraps
around `http#request` and `https#request` in order to trap the outgoing request
and the incoming response. These are then saved in a set of files. In playback
mode, the two request functions are overwritten completely, and it returns
dummy objects that read from the pre-recorded fixtures.
