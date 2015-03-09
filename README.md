# sepia - the way things used to be

Sepia is a VCR-like module for node.js that records HTTP interactions, then
plays them back exactly like the first time they were invoked. Sepia was
created to isolate a server from its remote downstream dependencies, for speed
and fault-tolerence.

Sepia should work with any HTTP library in node.js that uses `http#request` and
`https#request`. In practice, it has been extensively tested against [the
`request` module](https://github.com/mikeal/request), and there is a test to
ensure it works with [the `then-request`
module](https://github.com/then/then-request).

Sepia was developed and is in use at LinkedIn since early 2013. There, it is
used to improve the speed and reliability of the integration test suite for the
node.js server powering the mobile applications.

https://github.com/linkedin/sepia  
https://npmjs.org/package/sepia

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

## Running the examples

    cd sepia # wherever you installed the module
    npm install
    time VCR_MODE=record   node examples/http
    time VCR_MODE=playback node examples/http # notice it's much faster!

The example is located in `examples/http.js`. It exercises the core
functionality of the module.

    cd sepia
    npm install
    rm -r fixtures # in case you had previously generated fixtures
    VCR_MODE=cache node examples/cache

This example demonstrates the cache mode, which makes a real HTTP request and
records it if the fixture does not exist, but then reuses the fixture if it
does exist. Notice that the first call takes about one second, whereas the
second call finishes quickly.

To run all the examples in the correct modes, run:

    npm test

## Motivation

<img src="https://raw.github.com/linkedin/sepia/master/architecture-diagram-1.png" alt="" height="200" width="450" align="center" />

Sepia was created for the following use case:

* Integration tests are being run against a node.js server under test.
* The server under test makes HTTP requests to external downstream services.
* The integration tests are driven by a client running in a separate process
  than the server.

Even though the server is the system being tested, the stability of the
integration tests depends on the reliability of the downstream services.
Additionally, making HTTP calls to live downstream services makes the
integration tests very slow. To combat this, sepia hooks into the node.js
`http` and `https` modules inside the server process, intercepting outgoing
HTTP(S) requests. Sepia, records these requests, then plays them back the next
time the requests are made.

## VCR Modes

The value of the `VCR_MODE` environment variable determines how sepia behaves.
Acceptable values are:

* `record`: Make the downstream request, then save it to a fixture file.
* `playback`: Don't make the downstream request. Attempt to retrieve the data
  from the corresponding fixture file, and throw an error if the file does not
  exist.
* `cache`: First try to locate the fixture and play it back. If the fixture
  file does not exist, make the downstream request and save it to the file.

## Fixture Filenames

Fixture data generated during the recording phase are stored in files. In order
to uniquely associate each HTTP request with a filename used to store the
fixture data, several characteristics of the request are examined:

* The HTTP method, e.g. `GET` or `POST`.
* The request URL.
* The request body.
* The names of all the request headers.
* The names of all the cookies sent in the request.

This data is then aggregated and sent through an MD5 hash to produce the
filename. Users of sepia can hook into this process of constructing the
filename, as explained in a subsequent sections.

This core functionality is exercised in `examples/http.js` and
`examples/request.js`:

    time VCR_MODE=record   node examples/http
    time VCR_MODE=playback node examples/http

    time VCR_MODE=record   node examples/request
    time VCR_MODE=playback node examples/request

## Fixture Data

By default, the files are stored in `fixtures/generated` under the directory in
which the application was started. To override this:

    var sepia = require('sepia');
    sepia.fixtureDir(path.join(process.cwd(), 'sepia-fixtures'));

If this directory doesn't exist, it will be created.

This functionality is exercised in `examples/fixtureDir`:

    VCR_MODE=record   node examples/fixtureDir
    VCR_MODE=playback node examples/fixtureDir

## Configure

Sepia can be optionally configured using a call to `sepia.configure()`. All
options have default values, so they need not be configured unless necessary.

    var sepia = require('sepia');
    sepia.configure({
      verbose: true,
      debug: true
    });

The full list of options are as follows:

- `verbose`: outputs extra data whenever a fixture is accessed, along with the
  parts used to create the name of the fixture.
- `includeHeaderNames`, `headerWhitelist`, `includeCookieNames`,
  `cookieWhitelist`: detailed in a later section.
- 'debug': Useful for debugging the requests when there is a cache miss. If
   fixtures are recorded with debug mode true, Sepia will additionally save all
   the incoming requests  as '.request' files. Furthermore, in case of a cache
   miss, during playback, it will attempt to compare the the missing
   request(.missing), against all the available saved requests(.requests)
   to find the best match, by computing the string distance between each. The
   output will be the most similar request fixture, having the least string
   distance. Based on this url and body filters can be added which is explained
   in the next section.

   For performance and to minimize the search space & space complexity, it is
   recommended to have fixtures saved in separate folders per test or test suite.
   The debug feature is still under development and we will continue to refine
   it in the upcoming releases.

## URL and Body Filtering

Both the URL and the request body, if present, are used to generate the
filename for fixtures. The latter is used to differentiate between two POST or
PUT requests pointing to the same URL but differing only in the request body.

Sometimes, a request contains data in the URL or the body that is necessary for
the successful execution of that request, but changes from repeated invocations
of that resource. One typical example is a timestamp; another is a uniquely
generated request ID. However, sometimes two requests that have all other parts
of the request aside from these parameters constant should be considered the
same for recording and playback purposes.

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
in the order they are specified. The `url` property of the filter is used to
match the unmodified URL, regardless of the transformations it undergoes due to
matching `urlFilter` functions.

An example of this functionality can be found in `examples/filters`:

    VCR_MODE=record   node examples/filters
    VCR_MODE=playback node examples/filters

## Headers and Cookies

HTTP headers and cookies are often relevant to the way requests are served, but
their exact values are often highly variable. For example, the presence of
certain cookies may affect the authentication mechanism used behind the scenes,
and while one may wish to exercise both mechanisms, it is not useful to require
that the actual authentication cookie have a particular value.

Sepia generates filenames based on the presence and absence of header and
cookie _names_. In particular, all the header names are lower-cased and sorted
alphabetically, and this list is used to construct the fixture filename
corresponding to a request. The same applies to the cookie names.

If this feature is not desired, it can be disabled by calling
`sepia.configure()`:

    var sepia = require('sepia');
    sepia.configure({
      includeHeaderNames: false,
      includeCookieNames: false
    });

Additionally, a whitelist can be specified for the headers or for the cookies.
If the whitelist is empty, as is the default, all header names and cookie names
will be used to construct the fixture filename. If either whitelist has any
strings in it, only the corresponding headers or cookies will be used to
construct the filename. Either whitelist can be specified in isolation or both
may be specified:

    var sepia = require('sepia');
    sepia.configure({
      headerWhitelist: ['upgrade', 'via', 'x-custom'],
      cookieWhitelist: ['oldAuth', 'newAuth']
    });

Note that capitalization does not matter.

Examples of this functionality can be seen in `examples/headers.js`:

    rm -r fixtures # in case you had previously generated fixtures
    VCR_MODE=cache node examples/headers

## Languages

A downstream request may return different data based on the language requested
by the server under test. To support this use case, sepia automatically
isolates fixtures based on the value of the `Accept-Language` request header.

The first language in the list of languages specified by this header is used as
the directory name into which the fixtures will be placed for that request.
This directory is placed under the configured fixture directory. If no
languages are specified, either due to an empty value or due to the header not
being present in the first place, the fixtures will be placed directly into the
configured fixture directory.

Examples of this functionality can be seen in `examples/languages.js`:

    rm -r fixtures # in case you had previously generated fixtures
    VCR_MODE=record   node examples/languages
    VCR_MODE=playback node examples/languages

## VCR Cassettes

A series of downstream requests can be isolated, and their fixtures stored in a
separate directory, using sepia.fixtureDir(). However, this requires that the
grouping happens in the same process as the one running sepia. In the
motivating example given at the beginning of this document, the integration
test driver runs in a completely different process than the server managed by
sepia.

To help manage the sepia instance in a separate process, sepia itself can start
up an embedded HTTP server in the process where it replaces the HTTP request
functions. The test process can then communicate with this HTTP server and set
options, namely the directory into which fixtures will go. This architecture is
is visualized as follows:

<img src="https://raw.github.com/linkedin/sepia/master/architecture-diagram-2.png" alt="" height="210" width="450" align="center" />

This can be enabled by asking to start up the embedded server:

    var sepia = require('sepia').withSepiaServer();

Note that because this causes a new server to be started, the process that
includes sepia should shutdown the server as follows:

    sepia.shutdown();

This can be used to emulate "cassette"-like functionality:

    // suppose the process that is running sepia is bound to port 8080
    // in the test process
    request.post({
      url: 'localhost:58080/testOptions', // sepia's embedded server
      json: {
        testName: 'test1'
      }
    }, function(err, res, body) {
      // now, all requests made by localhost:8080 will have their fixtures
      // isolated into a directory name 'test1'
      request.get({
        url: 'localhost:8080/makeDownstreamRequests'
      });
    });

Note that the functionality of setting the test options will be available in a
sepia client library in the future.

Currently, the port of the embedded server is hard-coded to be `58080`, but
this will be configurable in the future. Furthermore, only the "test name" can
be set, but more options may become available.

An example of this functionality can be seen in `examples/testName.js`:

    rm -r fixtures # in case you had previously generated fixtures
    VCR_MODE=cache node examples/testName

### Bypassing the Cassette

When isolating a group of fixtures into a separate directory, it is sometimes
useful to specify a single fixture as "global," that is living outside the
test-specific directory and shared by multiple tests. To achieve this, a filter
can be added:

    var sepia = require('sepia');
    sepia.filter({
      url: /my-global-resource/,
      global: true
    });

Now, all requests whose URLs match `/my-global-resource/` will be placed in
the root of the configured `fixtureDir`, regardless of what the current test
name is.

### Cassettes Without Modifying Global State

The above approach to VCR cassettes modifies global state in the server managed
by sepia. This prevents running multiple tests--with different test names--in
parallel, because the nature of the global state is such that only one test
name can be set at one time. If you're willing to pass along information from
an incoming request down to a downstream request, sepia provides a stateless
alternative: the `x-sepia-test-name` header.

The `x-sepia-test-name` header, when passed to a downstream request, will
override the globally-configured test name. The header itself is not passed to
any downstream service, nor is the header name used in the calculation of the
fixture name.

The downside is that the server under test must pass along information from the
test integration runner to each of its downstream requests, because otherwise,
sepia has no means of determining the associated test name for a particular
dowstream request.

## Limitations

### Repeated Identical HTTP Requests

If the same request returns different data during different invocations, sepia
has no way of differentiating between the two invocations. This can happen
when, for example, a resources is fetched using a `GET` request, it is
modified using a `PUT` request, and it is fetched once more using a `GET`
request to verify that it was updated successfully.

While you can use the test name functionality described above, it may not be
semantically valid to spread fixtures for the same test under multiple
directories. One way around this currently is to actually make the requests
different in some way.

For example, in an integration test scenario, you may be able to pass a unique
identifier (e.g. `testUpdate1` and `testUpdate2`) along with each
request made from the test. Typically, this would be passed as a query
parameter that would be passed along by the server under test to any downstream
services, which would then ignore this parameter.

## Technical Details

Sepia wraps around the `http#request` and the `https#request` functions. Each
outgoing request is trapped. Depending on the value of the `VCR_MODE`
environment variable, the request is either made and stored in a file, or the
data is retrieved from a file and sent back using a dummy response object.

## Contributors

* [Vlad Shlosberg](https://github.com/vshlos)
* [Ethan Goldblum](https://github.com/egoldblum)
* [Shao-Hua Kao](https://github.com/ethankao)
* [Deepank Gupta](https://github.com/deepankgupta)
* [Priyanka Salvi](https://github.com/salvipriyanka/)
* [Ashima Atul](https://github.com/ashimaatul)

