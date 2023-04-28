for f in $1
do
	ext=${f:$(( ${#f} - 5 ))}
	if [[ $ext == '.json' ]] || [[ $ext == '.d.ts' ]]
	then
		git diff --no-index --ignore-all-space --color-moved $f ../wikiparser-node/$f
	else
		js=${f:0:$(( ${#f} - 2 ))}js
		git diff --no-index --ignore-all-space --color-moved --exit-code dist/$js ../wikiparser-node/$js
	fi
done
