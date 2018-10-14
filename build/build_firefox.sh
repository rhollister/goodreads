#!/bin/bash

pushd .. > /dev/null

rm -rf dist
rm -f availablereads-firefox.zip

mkdir dist
cp -r src dist/
cp -r icons dist/
cp build/manifest.json.firefox dist/manifest.json

pushd dist > /dev/null
zip ../availablereads-firefox.zip -qr *
popd > /dev/null

popd > /dev/null