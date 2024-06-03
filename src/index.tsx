import { Html, html } from "@elysiajs/html";
import * as dotenv from "dotenv";
import { Elysia, t } from "elysia";
import { Base } from "./components/base";
import { Comment } from "./components/comment";
import { Details } from "./components/details";
import { Home } from "./components/home";
import { Post } from "./components/post";
import { PostForm } from "./components/post-form";
import { Pool } from "pg";
import { CommentSchema } from "./types/comment";
import { PostSchema } from "./types/post";
import { formatDate } from "./utils/formatDate";

dotenv.config();

// Configuração do pool de conexão do PostgreSQL
const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
});

const app = new Elysia()
  .use(html())
  .decorate("db", db)
  .decorate("formatDate", formatDate)
  .get("/", async ({ db, formatDate }) => {
    try {
      // Query para retornar todas as colunas de todos os registros da tabela posts
      const query = 'SELECT * FROM posts';

      const { rows } = await db.query<PostSchema>(query);

      return (
        <Base>
          <Home>
            {rows.map((post) => (
              <Post
                key={post.id}
                id={post.id}
                content={post.content}
                title={post.title}
                createdAt={formatDate(post.created_at)}
              ></Post>
            ))}
          </Home>
        </Base>
      );
    } catch (e) {
      console.error(e);
      throw new Error("Erro ao buscar posts");
    }
  })
  .get("/edit/:id", async ({ db, params, error }) => {
    try {
      // Query para retornar todas as colunas do registro da tabela posts onde o id é igual ao id passado como parâmetro
      const query = 'SELECT * FROM posts WHERE id = $1';

      const { rows } = await db.query<PostSchema>(query, [params.id]);
      const post = rows[0];

      if (!post) {
        return error(404, "Post não encontrado");
      }

      return <PostForm {...post} />;
    } catch (e) {
      console.error(e);
      return error(500, "Internal Server Error");
    }
  })
  .post(
    "/posts",
    async ({ db, body, error, formatDate }) => {
      try {
        // Query para inserir um novo registro na tabela posts
        const insertQuery = 'INSERT INTO posts (title, content) VALUES ($1, $2) RETURNING *';
        // Query para retornar todas as colunas do último registro da tabela posts
        const selectQuery = 'SELECT * FROM posts ORDER BY id DESC LIMIT 1';

        await db.query(insertQuery, [body.title, body.content]);
        const { rows } = await db.query<PostSchema>(selectQuery);

        const post = rows[0];

        if (!post) {
          return error(500, "Erro ao criar post");
        }

        return (
          <Post
            id={post.id}
            content={post.content}
            createdAt={formatDate(post.created_at)}
            title={post.title}
          ></Post>
        );
      } catch (e) {
        console.error(e);
        return error(500, "Internal Server Error");
      }
    },
    {
      body: t.Object({
        title: t.String(),
        content: t.String(),
      }),
    }
  )
  .patch(
    "/posts/:id",
    async ({ db, body, params, error }) => {
      try {
        // Query para atualizar o registro da tabela posts onde o id é igual ao id passado como parâmetro
        const updateQuery = 'UPDATE posts SET title = $1, content = $2 WHERE id = $3';
        // Query para retornar todas as colunas do registro da tabela posts onde o id é igual ao id passado como parâmetro
        const selectQuery = 'SELECT * FROM posts WHERE id = $1';

        await db.query(updateQuery, [body.title, body.content, params.id]);

        const { rows } = await db.query<PostSchema>(selectQuery, [params.id]);
        const post = rows[0];

        if (!post) {
          return error(404, "Post não encontrado");
        }

        return (
          <Post
            id={post.id}
            content={post.content}
            title={post.title}
            createdAt={formatDate(post.created_at)}
          />
        );
      } catch (e) {
        console.error(e);
        return error(500, "Internal Server Error");
      }
    },
    {
      body: t.Object({
        title: t.String(),
        content: t.String(),
      }),
    }
  )
  .delete("/posts/:id", async ({ db, params, error }) => {
    try {
      // Query para deletar o registro da tabela posts onde o id é igual ao id passado como parâmetro
      const query = 'DELETE FROM posts WHERE id = $1';

      await db.query(query, [params.id]);
      return { message: 'Post deletado com sucesso' };
    } catch (e) {
      console.error(e);
      return error(500, "Internal Server Error");
    }
  })
  .get("/posts/:id", async ({ db, params, error }) => {
    try {
      // Query para retornar todas as colunas do registro da tabela posts onde o id é igual ao id passado como parâmetro
      const postsQuery = 'SELECT * FROM posts WHERE id = $1';
      // Query para retornar as colunas content, created_at, e id dos registros da tabela comments onde o id do post relacionado é igual ao id passado como parâmetro
      const commentsQuery = 'SELECT id, content, created_at FROM comments WHERE post_id = $1';

      const { rows: postRows } = await db.query<PostSchema>(postsQuery, [params.id]);
      const post = postRows[0];

      if (!post) {
        return error(404, "Post não encontrado");
      }

      const { rows: commentRows } = await db.query<CommentSchema>(commentsQuery, [params.id]);
      post.comments = commentRows;

      return (
        <Details postId={post.id}>
          <Post
            id={post.id}
            title={post.title}
            content={post.content}
            createdAt={formatDate(post.created_at)}
            showSidebar={false}
          ></Post>
          <div id={"comments"} className={"w-full h-2/4 flex flex-col gap-4"}>
            {post.comments.map((comment) => (
              <Comment key={comment.id} {...comment}></Comment>
            ))}
          </div>
        </Details>
      );
    } catch (e) {
      console.error(e);
      return error(500, "Internal Server Error");
    }
  })
  .post(
    "/comments/:postId",
    async ({ db, body, params, error }) => {
      try {
        // Query para inserir um novo registro na tabela comments, atribuindo os valores passados no corpo da requisição para as colunas content e post_id
        const insertQuery = 'INSERT INTO comments (content, post_id) VALUES ($1, $2) RETURNING *';
        // Query para retornar todas as colunas do último registro da tabela comments onde o id do post relacionado é igual ao id passado como parâmetro
        const selectQuery = 'SELECT * FROM comments WHERE post_id = $1 ORDER BY id DESC LIMIT 1';

        await db.query(insertQuery, [body.content, params.postId]);

        const { rows } = await db.query<CommentSchema>(selectQuery, [params.postId]);
        const comment = rows[0];

        if (!comment) {
          return error(500, "Erro ao criar comentário");
        }

        return <Comment {...comment} />;
      } catch (e) {
        console.error(e);
        return error(500, "Internal Server Error");
      }
    },
    {
      body: t.Object({
        content: t.String(),
      }),
    }
  )
  .delete("/comments/:id", async ({ db, params, error }) => {
    try {
      // Query para deletar o registro da tabela comments onde o id é igual ao id passado como parâmetro
      const query = 'DELETE FROM comments WHERE id = $1';

      await db.query(query, [params.id]);
      return { message: 'Comentário deletado com sucesso' };
    } catch (e) {
      console.error(e);
      return error(500, "Internal Server Error");
    }
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
