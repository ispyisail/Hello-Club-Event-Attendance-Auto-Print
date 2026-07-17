jest.mock('child_process');
jest.mock('../src/services/logger');

const { execFile } = require('child_process');
const { printPdf } = require('../src/services/cups-printer');

/**
 * The module wraps execFile with util.promisify. promisify calls execFile with
 * a trailing callback, so the mock invokes that callback to resolve/reject.
 */
function mockLpSuccess(stdout = 'request id is Test-1 (1 file(s))', stderr = '') {
  execFile.mockImplementation((cmd, args, cb) => cb(null, { stdout, stderr }));
}

function mockLpFailure(message = 'lp: Error - no default destination') {
  execFile.mockImplementation((cmd, args, cb) => cb(new Error(message)));
}

describe('cups-printer printPdf', () => {
  const originalPrinterName = process.env.PRINTER_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PRINTER_NAME;
  });

  afterAll(() => {
    if (originalPrinterName === undefined) {
      delete process.env.PRINTER_NAME;
    } else {
      process.env.PRINTER_NAME = originalPrinterName;
    }
  });

  it('prints to the default printer with just the file path', async () => {
    mockLpSuccess();

    const result = await printPdf('/tmp/out.pdf');

    expect(execFile).toHaveBeenCalledWith('lp', ['/tmp/out.pdf'], expect.any(Function));
    expect(result).toContain('request id');
  });

  it('passes the printer name when PRINTER_NAME is set', async () => {
    process.env.PRINTER_NAME = 'BackOffice';
    mockLpSuccess();

    await printPdf('/tmp/out.pdf');

    expect(execFile).toHaveBeenCalledWith('lp', ['-d', 'BackOffice', '/tmp/out.pdf'], expect.any(Function));
  });

  it('adds -n when more than one copy is requested', async () => {
    mockLpSuccess();

    await printPdf('/tmp/out.pdf', 3);

    expect(execFile).toHaveBeenCalledWith('lp', ['-n', '3', '/tmp/out.pdf'], expect.any(Function));
  });

  it('does not add -n for a single copy', async () => {
    mockLpSuccess();

    await printPdf('/tmp/out.pdf', 1);

    expect(execFile).toHaveBeenCalledWith('lp', ['/tmp/out.pdf'], expect.any(Function));
  });

  it('ignores an out-of-range copy count', async () => {
    mockLpSuccess();

    await printPdf('/tmp/out.pdf', 99);

    expect(execFile).toHaveBeenCalledWith('lp', ['/tmp/out.pdf'], expect.any(Function));
  });

  it('combines printer name and copies', async () => {
    process.env.PRINTER_NAME = 'BackOffice';
    mockLpSuccess();

    await printPdf('/tmp/out.pdf', 2);

    expect(execFile).toHaveBeenCalledWith('lp', ['-d', 'BackOffice', '-n', '2', '/tmp/out.pdf'], expect.any(Function));
  });

  it('throws a descriptive error when lp fails', async () => {
    mockLpFailure();

    await expect(printPdf('/tmp/out.pdf')).rejects.toThrow('CUPS print failed for /tmp/out.pdf');
  });

  it('falls back to stderr when stdout is empty', async () => {
    mockLpSuccess('', 'queued on Test');

    const result = await printPdf('/tmp/out.pdf');

    expect(result).toBe('queued on Test');
  });
});
