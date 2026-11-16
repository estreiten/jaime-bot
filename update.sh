git fetch
sleep 5
git checkout -- .
if [ -n "$2" ]; then
  git checkout $1
fi
git log --format=%B @{u}...HEAD
git pull