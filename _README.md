# Internal info

- files/folders
  - starting with `_`, `.`, `#`
  - ending with `~`
    are not built
- split email into JavaScript char array:

```sh
node -e 'console.log("put_email_address_here".split(""))' | tr '\n' ' ' | tr -d " " && echo ""
```
