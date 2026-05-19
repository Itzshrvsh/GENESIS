import ollama

MODEL = "gpt-oss:120b-cloud"

def ask_llm(system_prompt, user_prompt):

    response = ollama.chat(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    )

    return response["message"]["content"] 