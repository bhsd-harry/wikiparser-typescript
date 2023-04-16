ext=${1:$(( ${#1} - 5 ))}
if [[ $ext == '.json' ]] || [[ $ext == '.d.ts' ]]
then
	js=$1
	src=$1
else
	js=${1:0:$(( ${#1} - 2 ))}js
	src=dist/$js
fi
git diff --no-index --ignore-all-space $src ../wikiparser-node/$js
