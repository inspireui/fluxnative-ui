# Security policy

## Supported versions

FluxNative UI is pre-1.0. Security fixes go into the latest 0.x release only;
older 0.x releases do not get backports. Until the first release is on npm,
fixes land on `main`.

| Version | Supported |
|---|---|
| latest 0.x | yes |
| older 0.x | no |

## Reporting a vulnerability

Please do not open a public issue, discussion or pull request for a
vulnerability. Report it privately through GitHub:

**https://github.com/inspireui/fluxnative-ui/security/advisories/new**

(or the **Report a vulnerability** button on the repository's Security tab).

Include what you can of:

- the affected package(s) and version, or the commit;
- what an attacker can do, and under which conditions;
- steps to reproduce, or a proof of concept;
- a suggested fix or workaround, if you have one;
- whether you want to be credited, and under what name.

The maintainers reply in the private advisory, agree on a disclosure date
with you, and publish a GitHub security advisory with the fix.

Problems in a dependency (Expo, React Native, Uniwind, Tailwind CSS) belong
upstream, unless FluxNative UI uses the dependency in an unsafe way.

There is no bug bounty program.
