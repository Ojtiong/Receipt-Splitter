# Commits and messages to the repository
This document dedicates to doing commits and messages with good practice. This concern was raised when tags "STABLE" & "UNSTABLE" was used, outside of standard practice. On 2/6/2026 this repository will align with industry standard, but with "STABLE" remaining.

## Good practice
```txt
Your commit message should be:

- Understandable
- Not excessive
- Unambiguous

Before coming up with a commit message you should consider:

- Why did I add this commit?
- What changes does this commit make?
- Are the changes necessary?
- Do the changes solve any ticket or do they refer to any external links or part of the code?
```
<cite>[Tuase [1]](#ref-tuase)</cite>

## Template
```txt
{type}[optional scope]: {description}

[optional body]

[optional footer]
```
<cite>[Tuase [1]](#ref-tuase)</cite>

## Tags Used
- fix: This is to commit a resolved bug in the codebase

- feat: This is to commit a new feature to the code base

- chore: This commits changes that are not related to a feature or a bug it involves modification, updating dependencies, cleaning code, or commenting

- refactor: this commits changes that involve refactored code, that includes refactored code or changes

- docs: This commits changes made on the documentation, readme.md or markdown files, does not include in-code comments

- style: This involves style changes in the codebase

- test: This commits changes made in the test file including corrections made

- perf: This commits to improve the app's performances

- build: These are files that involve the build files and blue dependency

- revert: This commit signifies reverting to a previous commit

- STABLE: This commit is tested and run without any problems, used for confirming before a pull request / merge

- (NOT USED) ci: This commits make changes in the CI integration like the files and scripts 

## Scoping
Scoping is optional, but putting it helps give clear context and shorten the message. Scope would contain the module/file name it focuses on. 

## Example
Using git commit to show header and body
1. A small commit that fixes a specific bug.

`git commit -m "fix - bug in Monitoring data - showing all rows with scrollbar" -m "{optional body describing the bug and why it is fixed}"`

(with scoping)

`git commit -m "fix[Monitoring] - showing all rows with scrollbar" -m "{optional body describing the bug and why it is fixed}"`


2. A large commit containing a refactor of a portion of a code and documentation

you should split them into two separate commits

`git commit -m "chore - refactor code, reduce file sizes, clear comments"`
`git commit -m "docs - added code changes and structure to doc.md"`


3. A stable commit before merging to `main`

`git commit -m "STABLE - checked and tested Monitoring feature integrity"`

(pull request and merge commit)

`git commit -m "Merge dev to main - Monitoring feature"`

(optional code review for good team practice)


## Appendix
- Clean your code before merging!

- Ref <cite>[[2]](#ref-panop)</cite> is one of a clean, small open source project that I refered you can take a look into :)

## References
<a id="ref-tuase">
[1]: Segun Tuase. (2022, May 23). A Guide to writing Industry Standard Git Commit Message. DEV Community. https://dev.to/tuasegun/a-guide-to-writing-industry-standard-git-commit-message-2ohl
</a>
<a id="ref-panop">
[2]: Commits · Panopticon-AI-team/panopticon. (2025). GitHub. https://github.com/Panopticon-AI-team/panopticon/commits/main/
</a>
‌