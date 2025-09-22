# Installation Guide

This guide will walk you through the process of setting up and running the project.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js**: This project is built on Node.js. You can download it from [https://nodejs.org/](https://nodejs.org/).
- **npm**: The Node Package Manager is included with Node.js and is used to manage the project's dependencies.
- **Git**: You will need Git to clone the repository. You can download it from [https://git-scm.com/](https://git-scm.com/).
- **Python**: Required by the `node-gyp` build tool. You can download it from [https://www.python.org/](https://www.python.org/).

You can verify that the primary tools are installed by running the following commands, which will display their respective versions:

```bash
node -v
npm -v
git --version
python --version
```

> **Important Note on Build Tools**
> One of this project's dependencies (`sqlite3`) may need to be compiled from source. This requires a build toolchain (`node-gyp`) which depends on Python and a C++ compiler.
>
> **Python 3.12+ Users:** The `distutils` module has been removed from Python 3.12 and newer, which will cause an error when `node-gyp` tries to build `sqlite3`. To fix this, you must manually install `setuptools`:
> ```bash
> pip install setuptools
> ```
>
> - **Windows:** Install Python from python.org. Install the "Desktop development with C++" workload from the [Visual Studio Installer](https://visualstudio.microsoft.com/downloads/).
> - **macOS:** Install Python (if not already present). Install the Xcode Command Line Tools by running `xcode-select --install`.
> - **Linux:** Install Python (e.g., `sudo apt install python3`). Install a compiler like GCC (e.g., `sudo apt install build-essential`).

## Printing Requirements

This application can print PDFs directly to a physical printer. This functionality depends on the `pdf-to-printer` package, which has the following system requirements:

-   **Windows:** You must install **SumatraPDF**. You can download it from [https://www.sumatrapdfreader.org/free-pdf-reader](https://www.sumatrapdfreader.org/free-pdf-reader).
-   **macOS/Linux:** A printer must be configured through the system's printing service (e.g., CUPS). The application will print to the default system printer unless another is specified.

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
   ```

2. **Navigate to the project directory:**
   ```bash
   cd Hello-Club-Event-Attendance-Auto-Print
   ```

3. **Install the dependencies:**
   ```bash
   npm install
   ```

## Running the Program

To run the program, use the following command:

```bash
node index.js
```

## Running Tests

To run the automated tests, use the following command:

```bash
npm test
```

To see the test coverage, run:

```bash
npm run coverage
```
