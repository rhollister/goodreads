#!/bin/bash

pushd .. > /dev/null

rm -rf dist
rm -f availablereads-chrome.zip

mkdir dist
cp -r src dist/
cp -r icons dist/
cp build/manifest.json.chrome dist/manifest.json

pushd dist > /dev/null
zip ../availablereads-chrome.zip -qr *
popd > /dev/null

popd > /dev/null
