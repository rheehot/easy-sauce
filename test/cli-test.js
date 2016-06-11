const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const sinon = require('sinon');
const cli = require('../lib/cli');
const EasySauce = require('../lib/easy-sauce');
const Logger = require('../lib/logger');
const pkg = require('../package.json');


describe('cli', () => {

  beforeEach(() => {
    // Stubs pipe to call resume to put the stream into flowing mode.
    sinon.stub(Logger.prototype, 'pipe', Logger.prototype.resume);
    sinon.stub(EasySauce.prototype, 'runTestsAndLogResults')
        .returns(new Logger());
  });


  afterEach(() => {
    Logger.prototype.pipe.restore();
    EasySauce.prototype.runTestsAndLogResults.restore();
  });


  it('shows the usage info given the -h or --help options', (done) => {
    sinon.stub(process.stdout, 'write', () => {
      assert(process.stdout.write.lastCall.calledWith(sinon.match(
          (value) => value.toString().includes('Usage: easy-sauce'))));

      if (process.stdout.write.callCount == 2) {
        process.stdout.write.restore();
        done();
      }
    });

    cli({h: true});
    cli({help: true});
  });


  it('shows the version given the -V or --version options', (done) => {
    sinon.stub(process.stdout, 'write', () => {
      assert(process.stdout.write.lastCall.calledWith(sinon.match(
          (value) => value.toString().includes(pkg.version))));

      if (process.stdout.write.callCount == 2) {
        process.stdout.write.restore();
        done();
      }
    });

    cli({V: true});
    cli({version: true});
  });


  it('uses data from the -c or --config file option if specified', () => {
    let configFile = './test/fixtures/config.json';

    cli({c: configFile});
    cli({config: configFile});

    let stub = EasySauce.prototype.runTestsAndLogResults;

    assert(stub.calledTwice);
    assert(Logger.prototype.pipe.calledTwice);

    let firstThisValue = stub.firstCall.thisValue;
    let secondThisValue = stub.secondCall.thisValue;
    let configOpts = fs.readJsonSync(configFile);

    assert.equal(firstThisValue.opts.port, configOpts.port);
    assert.equal(firstThisValue.opts.tests, configOpts.tests);
    assert.deepEqual(firstThisValue.opts.platforms, configOpts.platforms);

    assert.equal(secondThisValue.opts.port, configOpts.port);
    assert.equal(secondThisValue.opts.tests, configOpts.tests);
    assert.deepEqual(secondThisValue.opts.platforms, configOpts.platforms);
  });


  it('uses data from package.json if an easySauce property exists', () => {
    let testPath = path.resolve('./test/fixtures');
    sinon.stub(process, 'cwd').returns(testPath);

    let pkgOpts = fs.readJsonSync('./test/fixtures/package.json').easySauce;

    cli({});

    let stub = EasySauce.prototype.runTestsAndLogResults;

    assert(stub.calledOnce);
    assert(Logger.prototype.pipe.calledOnce);

    assert(stub.calledOnce);

    let thisValue = stub.firstCall.thisValue;
    assert.equal(thisValue.opts.port, pkgOpts.port);
    assert.deepEqual(thisValue.opts.platforms, pkgOpts.platforms);
    assert.equal(thisValue.opts.build, pkgOpts.build);

    process.cwd.restore();
  });


  it('does not use data from package.json if -c or --config is set', () => {
    let testPath = path.resolve('./test/fixtures');
    sinon.stub(process, 'cwd').returns(testPath);

    let configFile = './test/fixtures/config.json';
    cli({config: configFile});

    let stub = EasySauce.prototype.runTestsAndLogResults;

    let pkgOpts = fs.readJsonSync('./test/fixtures/package.json').easySauce;

    assert(stub.calledOnce);
    assert.notEqual(stub.firstCall.thisValue.opts.build, pkgOpts.build);

    process.cwd.restore();
  });


  it('errors if given an invalid or missing config file', () => {
    sinon.stub(process.stderr, 'write');
    sinon.stub(process, 'exit');

    cli({c: './config.json'});
    cli({config: './test/fixtures/invalid-config.json'});

    assert(process.exit.calledTwice);
    assert(process.exit.alwaysCalledWith(1));
    assert(process.stderr.write.calledTwice);
    assert(process.stderr.write.alwaysCalledWith(
        sinon.match('No config options found at')));

    process.stderr.write.restore();
    process.exit.restore();
  });


  it('uses Sauce Labs credentials from the ENV variables if set', () => {
    process.env.SAUCE_USERNAME = 'me';
    process.env.SAUCE_ACCESS_KEY = 'password';

    cli({});

    let stub = EasySauce.prototype.runTestsAndLogResults;
    assert(stub.calledOnce);
    assert.equal(stub.lastCall.thisValue.opts.username, 'me');
    assert.equal(stub.lastCall.thisValue.opts.key, 'password');

    delete process.env.SAUCE_USERNAME;
    delete process.env.SAUCE_ACCESS_KEU;
  });


  it('uses shorthand command line options if present', () => {
    let platforms = '[["Windows 10", "chrome", "latest"],' +
        '["OS X 10.11", "firefox","latest"],["OS X 10.11", "safari", "9"]]';

    cli({
      P: platforms,
      t: '/tests/suite.html',
      p: 1979,
      b: '1',
      n: 'Unit Tests',
      f: 'custom',
      v: true,
      q: true
    });

    let stub = EasySauce.prototype.runTestsAndLogResults;
    assert(stub.calledOnce);
    assert.deepEqual(stub.lastCall.thisValue.opts.platforms, [
      ['Windows 10', 'chrome', 'latest'],
      ['OS X 10.11', 'firefox', 'latest'],
      ['OS X 10.11', 'safari', '9']
    ]);
    assert.equal(stub.lastCall.thisValue.opts.tests, '/tests/suite.html');
    assert.equal(stub.lastCall.thisValue.opts.port, 1979);
    assert.equal(stub.lastCall.thisValue.opts.build, '1');
    assert.equal(stub.lastCall.thisValue.opts.name, 'Unit Tests');
    assert.equal(stub.lastCall.thisValue.opts.framework, 'custom');
    assert.equal(stub.lastCall.thisValue.opts.verbose, true);
    assert.equal(stub.lastCall.thisValue.opts.quiet, true);
  });


  it('uses longhand command line options if present', () => {
    let platforms = '[["Windows 10", "chrome", "latest"],' +
        '["OS X 10.11", "firefox","latest"],["OS X 10.11", "safari", "9"]]';

    cli({
      platforms: platforms,
      tests: '/tests/suite.html',
      port: 1979,
      build: '1',
      name: 'Unit Tests',
      framework: 'custom',
      verbose: true,
      quiet: true
    });

    let stub = EasySauce.prototype.runTestsAndLogResults;
    assert(stub.calledOnce);
    assert.deepEqual(stub.lastCall.thisValue.opts.platforms, [
      ['Windows 10', 'chrome', 'latest'],
      ['OS X 10.11', 'firefox', 'latest'],
      ['OS X 10.11', 'safari', '9']
    ]);
    assert.equal(stub.lastCall.thisValue.opts.tests, '/tests/suite.html');
    assert.equal(stub.lastCall.thisValue.opts.port, 1979);
    assert.equal(stub.lastCall.thisValue.opts.build, '1');
    assert.equal(stub.lastCall.thisValue.opts.name, 'Unit Tests');
    assert.equal(stub.lastCall.thisValue.opts.framework, 'custom');
    assert.equal(stub.lastCall.thisValue.opts.verbose, true);
    assert.equal(stub.lastCall.thisValue.opts.quiet, true);
  });


  it('errors if given an unparseable -P or --platforms option', () => {
    sinon.stub(process.stderr, 'write');
    sinon.stub(process, 'exit');

    cli({P: '["Windows 10", "chrome", "50"],["Linux", "firefox", "4"]'});
    cli({platforms: '"Windows 10", "chrome", "50"'});


    assert(process.exit.calledTwice);
    assert(process.exit.alwaysCalledWith(1));
    assert(process.stderr.write.calledTwice);
    assert(process.stderr.write.alwaysCalledWith(
        sinon.match('could not be converted to an array')));

    process.stderr.write.restore();
    process.exit.restore();
  });


  it('favors CLI options over config options', () => {
    let testPath = path.resolve('./test/fixtures');
    sinon.stub(process, 'cwd').returns(testPath);

    let configFile = './test/fixtures/config.json';
    cli({
      config: configFile,
      port: 9999
    });

    let configOpts = fs.readJsonSync(configFile);
    let stub = EasySauce.prototype.runTestsAndLogResults;

    assert(stub.calledOnce);
    assert.equal(stub.firstCall.thisValue.opts.port, 9999);
    assert.equal(stub.firstCall.thisValue.opts.tests, configOpts.tests);
  });


  it('exits with a status code of 1 if an error occurred', () => {
    sinon.stub(process.stderr, 'write');
    sinon.stub(process, 'exit');

    cli({});
    Logger.prototype.pipe.lastCall.thisValue.emit('error', new Error('fail'));

    assert(process.stderr.write.calledOnce);
    assert(process.stderr.write.calledWith(sinon.match('fail')));
    assert(process.exit.calledOnce);
    assert(process.exit.calledWith(1));

    process.stderr.write.restore();
    process.exit.restore();
  });


  it('exits with a status code of 0 if no errors occured', (done) => {
    sinon.stub(process, 'exit');

    cli({});

    let logger = Logger.prototype.pipe.lastCall.thisValue;

    logger.on('end', () => {
      assert(process.exit.calledOnce);
      assert(process.exit.calledWith(0));
      process.exit.restore();
      done();
    });

    logger.end();
  });

});