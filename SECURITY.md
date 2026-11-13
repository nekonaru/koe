# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | yes       |

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub:

- Go to the repository's **Security** tab and use **Report a vulnerability** (private vulnerability reporting).

Please do not open a public issue for security problems. Include steps to reproduce, the affected version (or commit), and the impact. You can expect an acknowledgement within a few days.

## Scope

koe is a fully static site with no backend and no user data on any server. The main risks in scope are:

- Cross-site scripting in the web app
- Content-Security-Policy or response header misconfiguration in `public/_headers`
- Malicious model files (models are loaded from `huggingface.co` and executed as WebAssembly; integrity depends on the upstream repository)

Out of scope: vulnerabilities in third-party services (Hugging Face, Cloudflare Pages) and in the browser itself.
