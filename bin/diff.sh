ext=${1:$(( ${#1} - 5 ))}
if [[ $ext == '.json' ]] || [[ $ext == '.d.ts' ]]
then
	git diff --no-index --ignore-all-space --color-moved $1 ../wikiparser-node/$1
else
	js=${1:0:$(( ${#1} - 2 ))}js
	git diff --no-index --ignore-all-space --color-moved --exit-code dist/$js ../wikiparser-node/$js
fi
