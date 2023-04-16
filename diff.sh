ext=${1:$(( ${#1} - 5 ))}
if [[ $ext == '.json' ]] || [[ $ext == '.d.ts' ]]
then
	js=$1
	git diff --no-index --ignore-all-space --color-moved $1 ../wikiparser-node/$js
else
	js=${1:0:$(( ${#1} - 2 ))}
	git diff --no-index --ignore-all-space --color-moved --exit-code dist/${js}js ../wikiparser-node/${js}js
	if [[ $? -eq 0 ]]
	then
		git diff --no-index --ignore-all-space --color-moved dist/${js}d.ts ../wikiparser-node/${js}d.ts
	fi
fi
