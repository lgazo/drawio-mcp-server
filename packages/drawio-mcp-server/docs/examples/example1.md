# Example 1

## configuration

Local development setup with CLine extension in VS Codium:

```json
{
  "mcpServers": {
    "drawio": {
      "disabled": false,
      "timeout": 60,
      "command": "node",
      "args": [
        "--inspect",
        "/home/user/drawio-mcp-server/build/index.js"
      ],
      "transportType": "stdio"
    }
  }
}
```

## prompt

```
create a drawio diagram of a standard microservice architecture on aws. the stack should include a web frontend, service layer using a combination of aws lambda and microservice and two different databases
```

## response

[draw.io xml](./example1.drawio.xml)

![draw.io svg](./example1.drawio.svg)
