# Changelog

## [2.1.1] - 2018-11-09
## Added
- Upload and replace methods now support file blogs. ([#86](https://github.com/vimeo/vimeo.js/pull/86), [@nicolastakashi](https://github.com/nicolastakashi))

## [2.1.0] - 2018-04-03
## Changed
- Upgrading [tus-js-client](https://www.npmjs.com/package/tus-js-client) to `^1.5.1`. ([#73](https://github.com/vimeo/vimeo.js/issues/73))

## [2.0.2] - 2018-04-02
### Added
- Changelog

### Changed
- Uploads no longer make a pre-emptive request to check the user's quota. This check is done automatically when making a POST to `/me/videos`. ([#70](https://github.com/vimeo/vimeo.js/pull/70))

## [2.0.1] - 2018-03-04
### Fixed
- Fixed assigning an empty object when no params are passed to upload or replace. ([#66](https://github.com/vimeo/vimeo.js/pull/66), [@ArvinH](https://github.com/ArvinH))

## [2.0.0] - 2018-02-06
### Changed
- Library now uses the [Standard](https://standardjs.com/) code style.  ([#58](https://github.com/vimeo/vimeo.js/pull/58))
- Moving API requests over to use API v3.4. ([#58](https://github.com/vimeo/vimeo.js/pull/58))
- Moving uploads over to using the new tus protocol. ([#58](https://github.com/vimeo/vimeo.js/pull/58), [@peixian](https://github.com/peixian))
- Updating examples to use JSON filters. ([#54](https://github.com/vimeo/vimeo.js/pull/54), (@jehartzog)[https://github.com/jehartzog])

## [1.2.1] - 2017-04-10
### Fixed
- A deprecation warning in `fs.close`. ([#48](https://github.com/vimeo/vimeo.js/issues/48), [@OmerZfira](https://github.com/OmerZfira))

## [1.2.0] - 2016-02-29
### Added
- Support for optional access token during SDK creation. ([#5](https://github.com/vimeo/vimeo.js/pull/5), [@AidenMontgomery](https://github.com/AidenMontgomery))
- Search example. ([#9](https://github.com/vimeo/vimeo.js/pull/9), [@greedo](https://github.com/greedo))
- Support for missing leading slashes in API paths. ([#29](https://github.com/vimeo/vimeo.js/pull/29), [@prestonvanloon](https://github.com/prestonvanloon))
- Upload progress. ([#35](https://github.com/vimeo/vimeo.js/pull/35))

### Fixed
- Bad links in the README. ([#32](https://github.com/vimeo/vimeo.js/pull/32), [@joe-strummer](https://github.com/joe-strummer))
- Removing unnecessary `return` keywords. ([#26]https://github.com/vimeo/vimeo.js/pull/26)

## [v1.1.0] - 2014-09-09
### Added
- Replace source file.

### Removed
- Some stray `console.log` cals.

## v1.0.0 - 2014-07-28
### Added
- First release.

[2.1.1]: https://github.com/vimeo/vimeo.js/compare/2.1.0...2.1.1
[2.1.0]: https://github.com/vimeo/vimeo.js/compare/2.0.2...2.1.0
[2.0.2]: https://github.com/vimeo/vimeo.js/compare/2.0.1...2.0.2
[2.0.1]: https://github.com/vimeo/vimeo.js/compare/2.0.0...2.0.1
[2.0.0]: https://github.com/vimeo/vimeo.js/compare/1.2.1...2.0.0
[1.2.1]: https://github.com/vimeo/vimeo.js/compare/1.2.0...1.2.1
[1.2.0]: https://github.com/vimeo/vimeo.js/compare/v1.1.0...1.2.0
[v1.1.0]: https://github.com/vimeo/vimeo.js/compare/v1.0.0...v1.1.0
