js=${1:0:$(( ${#1} - 2 ))}js
git diff --no-index --ignore-all-space dist/$js ../wikiparser-node/$js
