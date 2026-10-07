# Changelog

## [0.1.7](https://github.com/genz-its/sevdesk/compare/sevdesk-cli-v0.1.6...sevdesk-cli-v0.1.7) (2026-10-07)


### Features

* add vouchers:document to download voucher documents ([#10](https://github.com/genz-its/sevdesk/issues/10)) ([9142673](https://github.com/genz-its/sevdesk/commit/9142673ce86efc7ae3694efbee70fff37b86e51b))


### Bug Fixes

* **cli:** replace deprecated `@robingenz/zli` with `zodline` ([#8](https://github.com/genz-its/sevdesk/issues/8)) ([901d73d](https://github.com/genz-its/sevdesk/commit/901d73dd78dd6d73027c08b7055cb5a634264e9a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @genz-its/sevdesk-sdk bumped from 0.1.5 to 0.1.6

## [0.1.6](https://github.com/genz-its/sevdesk/compare/sevdesk-cli-v0.1.5...sevdesk-cli-v0.1.6) (2026-08-05)


### Bug Fixes

* derive the booking amount sign from the voucher ([dc68020](https://github.com/genz-its/sevdesk/commit/dc680201eb5f1e1c8eeaf7df0a1b72d863a69847))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @genz-its/sevdesk-sdk bumped from 0.1.4 to 0.1.5

## [0.1.5](https://github.com/genz-its/sevdesk/compare/sevdesk-cli-v0.1.4...sevdesk-cli-v0.1.5) (2026-08-05)


### Features

* add contacts:update-address and contacts:delete-address ([c5f1117](https://github.com/genz-its/sevdesk/commit/c5f111752c2060994b997c044f7a32580879d372))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @genz-its/sevdesk-sdk bumped from 0.1.3 to 0.1.4

## [0.1.4](https://github.com/genz-its/sevdesk/compare/sevdesk-cli-v0.1.3...sevdesk-cli-v0.1.4) (2026-08-05)


### Features

* set the service period on vouchers:create ([8b73555](https://github.com/genz-its/sevdesk/commit/8b73555c04217195911c3c38abe4a7d69b717955))


### Bug Fixes

* paginate list commands instead of returning only the first page ([b3cd218](https://github.com/genz-its/sevdesk/commit/b3cd218a3bb8346a20a724b30515be22ae2c50ef))

## [0.1.3](https://github.com/genz-its/sevdesk/compare/sevdesk-cli-v0.1.2...sevdesk-cli-v0.1.3) (2026-08-04)


### Features

* add booking account lookup via undocumented AccountDatev endpoint ([56006b6](https://github.com/genz-its/sevdesk/commit/56006b6189fa481eafe81c4ed104ef7946025404))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @genz-its/sevdesk-sdk bumped from 0.1.2 to 0.1.3

## [0.1.2](https://github.com/genz-its/sevdesk/compare/sevdesk-cli-v0.1.1...sevdesk-cli-v0.1.2) (2026-08-04)

### Bug Fixes

- filter unbooked transactions client-side and render legacy voucher positions ([fd49258](https://github.com/genz-its/sevdesk/commit/fd492581bb6484f991fc5146727c4c552df1da6c))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @genz-its/sevdesk-sdk bumped from 0.1.1 to 0.1.2

## [0.1.1](https://github.com/genz-its/sevdesk/compare/sevdesk-cli-v0.1.0...sevdesk-cli-v0.1.1) (2026-08-04)

### Features

- add contact addresses, communication ways and voucher positions ([90edc22](https://github.com/genz-its/sevdesk/commit/90edc2275bbd99d568464814bb3da2bd1bb0e25d))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @genz-its/sevdesk-sdk bumped from 0.1.0 to 0.1.1

## 0.1.0 (2026-08-04)

### Features

- **cli:** add CLI foundation with login, logout and doctor commands ([cafe198](https://github.com/genz-its/sevdesk/commit/cafe19857554ad5c7a0fe9ce895cbd9c34e34fbc))
- **cli:** add contact, document, part, tag and export commands ([d3af8cb](https://github.com/genz-its/sevdesk/commit/d3af8cbcb16db00c9f9bb3656884e16afa636c7f))
- **cli:** add voucher, transaction, account and guidance commands ([13f092e](https://github.com/genz-its/sevdesk/commit/13f092eac0da5022f90cc5231f894693b1b3336d))
- resolve contact names in voucher, invoice, credit note and order views ([eb72bc4](https://github.com/genz-its/sevdesk/commit/eb72bc4bcf3f30a4aae2a50e065372e17c883775))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @genz-its/sevdesk-sdk bumped from 0.0.0 to 0.1.0
