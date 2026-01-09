# LCGH

A simple command line tool to push all your leetcode solutions to github.

## Requirements

- Bun 
- A leetcode account 
- Computer

## Installation

Since this repo includes creating and interacting with another git repo, in order to maintain a clean directory structure, it is recommended to clone this repo into an empty directory.

For example
```bash
mkdir leetccode
cd leetcode
git clone git@github.com:DGoel1602/lcgh.git
cd lcgh/
```

This will ensure that the solutions folder the script will make are made inside the leetcode directory instead of wherever the lcgh directory was made.

Final structure:
```text
leetcode/
├── lcgh/
│   └── index.ts
└── solutions/
    ├── easy/
    │   └── 11.cpp
    ├── medium/
    │   └── 111.cpp
    └── hard/
        └── 1111.cpp
```

## Usage

After cding into lcgh, make a .env file with the following contents

```env
LEETCODE_SESSION=""
CSRF_TOKEN=""
REPO_URL=""
```

Your leetcode session and CSRF token can be found within the dev tools' storage tab on all browsers. The REPO_URL is the url to your personal repo where you want your LC solutions to be commited. It is highly recommend that it is a SSH git url. You must have push perms to it for obvious reasons.

After that is set up you can simply run
```bash
bun install
bun run index.ts
```

Arguments:
```
--no-lc-sync: skips syncing your leetcode submissions in case you want it to only handle git stuff, this step also handles the creation of the solutions folder so make sure you have that.
--no-gh-sync: skips syncing your git repo to, this step includes initializing a git repo within the directory, setting the origin, commiting, pushing, etc.
```
