# My Own Ethos

To be a conscious actor in the new civilization, I am defining here my own ethos. It may be used for informed interaction with me. Feel free to fork and define your own.

## As JSON

[ethos.json](ethos.json)

## As Markdown

[ethos.md](ethos.md)

## Specifications Ver 1

The JSON file defines an object.

The object contains the attribute "version" with the integer value 1.

### Language: English

### Revision

The object contains the attribute "revision" with an integer value that increments with each revision.

### Last Revision

The object contains the attribute "last_revision" with the commit hash of the last commit. This together with the revision number transforms the ethos into a blockchain block.

### Self Hash

The object contains the attribute "hash" with the hash of contents of itself. It is calculated while the object has `  "hash": "",` as the hash definition line to avoid infinite recursion.

### Virtues Definitions

The object contains the attribute "virtues" which is an object with the English word for the virtues and the URI with their definitions as value. The definitions have to be intelligible to the English reader for each term.

### Hierarchy

The object contains the attribute "hierarchy" which is an array of arrays. The first value of the second array is a virtue that is defined in the "virtues" section. The other terms are synonyms or near-synonyms (by consensus or personal definition) or they simply have to exist at the same level until further dissection.

### Definitions

The object contains the attribute "definitions". It is an object that contains as keys any term defined differently than the dictionary or wikipedia. Also the default (catch-all) key "other". The value is the URI where these are defined. The URI has to be specific to immutable content.

### Principles

The object contains the attribute "principles". It is an object that specifies the principles that the person adheres to.

### Declarations

The object contains the attribute "declarations". The declarations have to respect the [Kantian Categorical Imperartive](https://en.wikipedia.org/wiki/Categorical_imperative).

### Profiles

The object contains the attribute "profiles". It is an object that specifies the profiles that the person wants or needs to make public. If the person is a public person (politicial, government official), this has to point to at least one official profile.

### Profile Information

The object contains the attribute "profile_info". It is an object that specifies the profile fields that should be automatically completed for any profile.

### Compatibility

The object contains the attribute "compatibility"

### Other Content

The object contains the attribute "state" that contains an object with a hash and an URI to any additional state.

### Integrity, Immutability, Precision

As an integrity stamp, we will use Keccak-256 as hash function. For example from [https://emn178.github.io/online-tools/keccak_256.html](https://emn178.github.io/online-tools/keccak_256.html)


## Created by

https://github.com/ctzurcanu/ethos
