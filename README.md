# 2112 Leaderboard

Sometimes there are events in 2112 that we want to follow the leaderboard
for, and see who's winning before they announce at the end.

This script will show the leaderboard.

# .wallet File

You need an Alchemy key to talk to Polygon, so your `~/.wallet` file
must look like:

```json
{
    "polygon_alchemy_key": "<ALCHEMY-KEY-HERE>"
}
```

(This is read-only, so it doesn't need a private key.)

# Blocks File

Events will occur over different block ranges. Specify the block range
for your event in a JSON file in the `data/` directory.

For example:

```json
{
    "start": 38234567,
    "end": null
}
```

Leave the `end` block `null` if the event is still ongoing and we want
to get _current_ scores. Once the event is over, lock in the ending block
so runs that happen when it's done do not impact the scores.

Note! You will need to edit the `BLOCKS_FILENAME` in the code to use the
blocks JSON file you've specified.
